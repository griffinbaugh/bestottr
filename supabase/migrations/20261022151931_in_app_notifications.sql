-- In-app listing decisions. Creation is atomic with the review event; no email is sent.
CREATE TABLE public.account_notifications (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 source_event_id bigint NOT NULL UNIQUE REFERENCES public.listing_review_events(id),
 review_id uuid NOT NULL REFERENCES public.listing_reviews(id),
 kind text NOT NULL CHECK(kind IN ('approve','reject','publish','unpublish')),
 title text NOT NULL CHECK(char_length(title)<=120),
 body text NOT NULL CHECK(char_length(body)<=2500),
 created_at timestamptz NOT NULL DEFAULT now(),
 read_at timestamptz
);
CREATE INDEX account_notifications_user_date_idx ON public.account_notifications(user_id,created_at DESC,id DESC);
CREATE INDEX account_notifications_unread_idx ON public.account_notifications(user_id) WHERE read_at IS NULL;
CREATE INDEX account_notifications_review_idx ON public.account_notifications(review_id);
ALTER TABLE public.account_notifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.account_notifications FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.account_notifications TO authenticated;
GRANT UPDATE(read_at) ON public.account_notifications TO authenticated;
GRANT ALL ON public.account_notifications TO service_role;
CREATE POLICY "Read own notifications" ON public.account_notifications FOR SELECT TO authenticated
 USING(user_id=(select auth.uid()) AND (select private.account_aal_allowed()));
CREATE POLICY "Mark own notifications read" ON public.account_notifications FOR UPDATE TO authenticated
 USING(user_id=(select auth.uid()) AND (select private.account_aal_allowed()))
 WITH CHECK(user_id=(select auth.uid()) AND (select private.account_aal_allowed()));
CREATE FUNCTION private.notify_listing_decision() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE listing public.listing_reviews; heading text; message text;
BEGIN
 IF NEW.action NOT IN ('approve','reject','publish','unpublish') THEN RETURN NEW;END IF;
 SELECT * INTO listing FROM public.listing_reviews WHERE id=NEW.review_id;
 IF NOT FOUND OR (NEW.action='unpublish' AND NEW.actor_id=listing.seller_id) THEN RETURN NEW;END IF;
 heading:=CASE NEW.action WHEN 'approve' THEN 'Listing approved' WHEN 'reject' THEN 'Changes requested' WHEN 'publish' THEN 'Listing published' ELSE 'Listing unpublished' END;
 message:=(listing.snapshot->>'title')||CASE NEW.action WHEN 'approve' THEN ' was approved. Approval does not make it public; publication is a separate step.' WHEN 'reject' THEN ' needs changes before it can be approved.' WHEN 'publish' THEN ' was published to the marketplace.' ELSE ' was removed from public view.' END;
 IF NEW.action IN ('reject','unpublish') AND trim(NEW.note)<>'' THEN message:=message||' '||NEW.note;END IF;
 INSERT INTO public.account_notifications(user_id,source_event_id,review_id,kind,title,body,created_at)
 VALUES(listing.seller_id,NEW.id,listing.id,NEW.action,heading,message,NEW.created_at)
 ON CONFLICT(source_event_id) DO NOTHING;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.notify_listing_decision() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.notify_listing_decision() TO service_role;
CREATE TRIGGER notify_listing_decision AFTER INSERT ON public.listing_review_events FOR EACH ROW EXECUTE FUNCTION private.notify_listing_decision();
-- Populate recent existing decisions once; retries cannot duplicate an event notification.
INSERT INTO public.account_notifications(user_id,source_event_id,review_id,kind,title,body,created_at)
SELECT r.seller_id,e.id,r.id,e.action,
 CASE e.action WHEN 'approve' THEN 'Listing approved' WHEN 'reject' THEN 'Changes requested' WHEN 'publish' THEN 'Listing published' ELSE 'Listing unpublished' END,
 (r.snapshot->>'title')||CASE e.action WHEN 'approve' THEN ' was approved. Approval does not make it public; publication is a separate step.' WHEN 'reject' THEN ' needs changes before it can be approved.' WHEN 'publish' THEN ' was published to the marketplace.' ELSE ' was removed from public view.' END||CASE WHEN e.action IN ('reject','unpublish') AND trim(e.note)<>'' THEN ' '||e.note ELSE '' END,e.created_at
FROM public.listing_review_events e JOIN public.listing_reviews r ON r.id=e.review_id
WHERE e.action IN ('approve','reject','publish','unpublish') AND NOT(e.action='unpublish' AND e.actor_id=r.seller_id) AND e.created_at>=now()-interval '30 days'
ON CONFLICT(source_event_id) DO NOTHING;
