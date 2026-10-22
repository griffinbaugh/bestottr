-- Reviewed versions are frozen. Anonymous catalog access is server-only and launch-gated.
CREATE TABLE public.listing_reviews (
 id uuid PRIMARY KEY,
 draft_id uuid REFERENCES public.listing_drafts(id) ON DELETE SET NULL,
 seller_id uuid NOT NULL REFERENCES public.profiles(id),
 state text NOT NULL DEFAULT 'preparing' CHECK(state IN ('preparing','in_review','approved','rejected','published','withdrawn','unpublished','failed')),
 version integer NOT NULL DEFAULT 0 CHECK(version>=0),
 snapshot jsonb NOT NULL CHECK(jsonb_typeof(snapshot)='object' AND jsonb_typeof(snapshot->'assets')='array'),
 rights_confirmed_at timestamptz NOT NULL DEFAULT now(),
 reviewer_id uuid REFERENCES public.profiles(id),
 reviewed_at timestamptz,
 decision_note text NOT NULL DEFAULT '' CHECK(char_length(decision_note)<=2000),
 ownership_checked_at timestamptz,
 published_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX listing_review_active_draft ON public.listing_reviews(draft_id) WHERE state IN ('preparing','in_review','approved','published');
CREATE UNIQUE INDEX listing_review_published_asset ON public.listing_reviews((snapshot->>'kind'),(snapshot->>'asset_id')) WHERE state='published' AND snapshot->>'kind' IN ('experience','community');
CREATE INDEX listing_reviews_seller_idx ON public.listing_reviews(seller_id,created_at DESC);
CREATE INDEX listing_reviews_queue_idx ON public.listing_reviews(state,created_at);
CREATE INDEX listing_reviews_reviewer_idx ON public.listing_reviews(reviewer_id);
CREATE TABLE public.listing_review_assets (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 review_id uuid NOT NULL REFERENCES public.listing_reviews(id),
 source_asset_id uuid NOT NULL,
 category text NOT NULL CHECK(category IN ('image','file')),
 filename text NOT NULL,
 content_type text NOT NULL,
 size_bytes bigint NOT NULL CHECK(size_bytes>0 AND size_bytes<=52428800),
 path text NOT NULL UNIQUE,
 position integer NOT NULL CHECK(position>=0),
 ready boolean NOT NULL DEFAULT false,
 UNIQUE(review_id,source_asset_id),
 CHECK(path=review_id::text||'/'||id::text),
 CHECK((category='image' AND size_bytes<=5242880 AND content_type IN ('image/jpeg','image/png','image/webp')) OR (category='file' AND content_type='application/octet-stream'))
);
CREATE TABLE public.listing_review_events (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 review_id uuid NOT NULL REFERENCES public.listing_reviews(id),
 actor_id uuid NOT NULL REFERENCES public.profiles(id),
 action text NOT NULL,
 note text NOT NULL DEFAULT '',
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX listing_review_events_review_idx ON public.listing_review_events(review_id,created_at);
CREATE INDEX listing_review_events_actor_idx ON public.listing_review_events(actor_id);
ALTER TABLE public.listing_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listing_review_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listing_review_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.listing_reviews,public.listing_review_assets,public.listing_review_events FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.listing_reviews,public.listing_review_events TO authenticated;
GRANT ALL ON public.listing_reviews,public.listing_review_assets,public.listing_review_events TO service_role;
GRANT USAGE,SELECT ON SEQUENCE public.listing_review_events_id_seq TO service_role;
CREATE POLICY "Sellers and moderators read reviews" ON public.listing_reviews FOR SELECT TO authenticated
 USING ((seller_id=(select auth.uid()) OR (select public.has_role(auth.uid(),'admin'))) AND (select private.account_aal_allowed()));
CREATE POLICY "Sellers and moderators read review events" ON public.listing_review_events FOR SELECT TO authenticated
 USING (EXISTS(SELECT 1 FROM public.listing_reviews r WHERE r.id=review_id) AND (select private.account_aal_allowed()));
-- Review file/image paths have no client grants. Server checks role + parent review before signing.
CREATE FUNCTION public.reserve_listing_review(p_review uuid,p_draft uuid,p_actor uuid,p_updated timestamptz,p_proof jsonb,p_rights boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE d public.listing_drafts; r public.listing_reviews; manifest jsonb; amount bigint;
BEGIN
 -- Serialize seller snapshot quotas and media reservations, then freeze the draft.
 PERFORM id FROM public.profiles WHERE id=p_actor FOR UPDATE;
 SELECT * INTO r FROM public.listing_reviews WHERE id=p_review;
 IF FOUND THEN
  IF r.seller_id<>p_actor OR r.draft_id IS DISTINCT FROM p_draft THEN RAISE EXCEPTION 'Review unavailable';END IF;
  RETURN jsonb_build_object('created',false,'review',to_jsonb(r));
 END IF;
 SELECT * INTO d FROM public.listing_drafts WHERE id=p_draft AND seller_id=p_actor FOR UPDATE;
 IF NOT FOUND OR d.updated_at<>p_updated OR p_rights IS DISTINCT FROM true THEN RAISE EXCEPTION 'Draft changed or rights not confirmed';END IF;
 IF EXISTS(SELECT 1 FROM public.listing_reviews WHERE draft_id=p_draft AND state IN ('preparing','in_review','approved','published')) THEN RAISE EXCEPTION 'Withdraw existing review before editing or resubmitting';END IF;
 IF d.price_cents<=0 OR length(trim(d.description))=0 THEN RAISE EXCEPTION 'Title, description and positive price required';END IF;
 IF d.format='auction' AND (d.auction_ends_at IS NULL OR d.auction_ends_at<=(extract(epoch from now())*1000)::bigint) THEN RAISE EXCEPTION 'Future auction end required';END IF;
 IF EXISTS(SELECT 1 FROM public.listing_assets WHERE draft_id=p_draft AND status<>'ready') THEN RAISE EXCEPTION 'Uploads incomplete';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.listing_assets WHERE draft_id=p_draft AND category='image' AND status='ready') THEN RAISE EXCEPTION 'Listing image required';END IF;
 IF d.cover_asset_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.listing_assets WHERE id=d.cover_asset_id AND draft_id=p_draft AND category='image' AND status='ready') THEN RAISE EXCEPTION 'Cover invalid';END IF;
 IF d.kind='file' AND NOT EXISTS(SELECT 1 FROM public.listing_assets WHERE draft_id=p_draft AND category='file' AND status='ready') THEN RAISE EXCEPTION 'Deliverable required';END IF;
 IF d.kind<>'file' AND (p_proof->>'asset_id' IS DISTINCT FROM d.asset_id OR p_proof->>'roblox_user_id' IS DISTINCT FROM d.roblox_user_id OR (p_proof->>'ownership_checked_at')::timestamptz<now()-interval '2 minutes' OR p_proof->>'ownership_checked_at' IS NULL) THEN RAISE EXCEPTION 'Fresh ownership proof required';END IF;
 SELECT coalesce(jsonb_agg(to_jsonb(a) ORDER BY position,created_at,id),'[]') INTO manifest FROM public.listing_assets a WHERE draft_id=p_draft;
 SELECT coalesce(sum(size_bytes),0) INTO amount FROM public.listing_assets WHERE draft_id=p_draft;
 IF amount+(SELECT coalesce(sum((a->>'size_bytes')::bigint),0) FROM public.listing_reviews previous CROSS JOIN LATERAL jsonb_array_elements(previous.snapshot->'assets') a WHERE previous.seller_id=p_actor)>314572800 THEN RAISE EXCEPTION 'Review snapshot storage limit reached; contact support';END IF;
 INSERT INTO public.listing_reviews(id,draft_id,seller_id,snapshot,ownership_checked_at)
 VALUES(p_review,p_draft,p_actor,to_jsonb(d)||jsonb_build_object('ownership_checked_at',CASE WHEN d.kind='file' THEN NULL ELSE p_proof->>'ownership_checked_at' END,'assets',manifest),CASE WHEN d.kind='file' THEN NULL ELSE (p_proof->>'ownership_checked_at')::timestamptz END) RETURNING * INTO r;
 RETURN jsonb_build_object('created',true,'review',to_jsonb(r));
END $$;
CREATE FUNCTION public.transition_listing_review(p_review uuid,p_actor uuid,p_version integer,p_action text,p_note text DEFAULT '',p_publish_allowed boolean DEFAULT false,p_proof jsonb DEFAULT '{}')
RETURNS public.listing_reviews LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE r public.listing_reviews; next_state text; is_admin boolean;
BEGIN
 SELECT * INTO r FROM public.listing_reviews WHERE id=p_review FOR UPDATE;
 IF NOT FOUND OR r.version<>p_version THEN RAISE EXCEPTION 'Review changed; refresh before continuing';END IF;
 is_admin:=public.has_role(p_actor,'admin');
 IF p_action IN ('submit','fail','withdraw') AND p_actor<>r.seller_id THEN RAISE EXCEPTION 'Seller access required';END IF;
 IF p_action IN ('approve','reject','publish') AND NOT is_admin THEN RAISE EXCEPTION 'Moderator access required';END IF;
 IF p_action='unpublish' AND p_actor<>r.seller_id AND NOT is_admin THEN RAISE EXCEPTION 'Access denied';END IF;
 IF length(p_note)>2000 THEN RAISE EXCEPTION 'Note too long';END IF;
 CASE p_action
 WHEN 'submit' THEN
  IF r.state<>'preparing' THEN RAISE EXCEPTION 'Not preparing';END IF;
  IF (SELECT count(*) FROM public.listing_review_assets WHERE review_id=r.id AND ready)<>jsonb_array_length(r.snapshot->'assets') OR EXISTS(SELECT 1 FROM public.listing_review_assets WHERE review_id=r.id AND NOT ready) THEN RAISE EXCEPTION 'Snapshots incomplete';END IF;
  next_state:='in_review';
 WHEN 'fail' THEN IF r.state<>'preparing' THEN RAISE EXCEPTION 'Not preparing';END IF;next_state:='failed';
 WHEN 'approve' THEN IF r.state<>'in_review' THEN RAISE EXCEPTION 'Not awaiting review';END IF;next_state:='approved';
 WHEN 'reject' THEN IF r.state<>'in_review' OR length(trim(p_note))<10 THEN RAISE EXCEPTION 'Rejection needs a reason';END IF;next_state:='rejected';
 WHEN 'withdraw' THEN IF r.state NOT IN ('preparing','in_review','approved') THEN RAISE EXCEPTION 'Cannot withdraw';END IF;next_state:='withdrawn';
 WHEN 'unpublish' THEN IF r.state<>'published' OR length(trim(p_note))<10 THEN RAISE EXCEPTION 'Unpublishing needs a reason';END IF;next_state:='unpublished';
 WHEN 'publish' THEN
  IF r.state<>'approved' OR p_publish_allowed IS DISTINCT FROM true OR r.draft_id IS NULL THEN RAISE EXCEPTION 'Publication is not enabled or review not approved';END IF;
  -- Auctions cannot be exposed as open bidding before a real bidding/settlement service exists.
  IF r.snapshot->>'format'<>'buy_now' THEN RAISE EXCEPTION 'Auction publication is not available';END IF;
  IF r.snapshot->>'kind'<>'file' AND (p_proof->>'asset_id' IS DISTINCT FROM r.snapshot->>'asset_id' OR p_proof->>'roblox_user_id' IS DISTINCT FROM r.snapshot->>'roblox_user_id' OR p_proof->>'ownership_checked_at' IS NULL OR (p_proof->>'ownership_checked_at')::timestamptz<now()-interval '2 minutes') THEN RAISE EXCEPTION 'Fresh ownership proof required';END IF;
  next_state:='published';
 ELSE RAISE EXCEPTION 'Unknown action';
 END CASE;
 UPDATE public.listing_reviews SET state=next_state,version=version+1,updated_at=now(),
  reviewer_id=CASE WHEN p_action IN ('approve','reject') THEN p_actor ELSE reviewer_id END,
  reviewed_at=CASE WHEN p_action IN ('approve','reject') THEN now() ELSE reviewed_at END,
  decision_note=CASE WHEN p_action IN ('approve','reject','unpublish') THEN trim(p_note) ELSE decision_note END,
  ownership_checked_at=CASE WHEN p_action='publish' AND snapshot->>'kind'<>'file' THEN (p_proof->>'ownership_checked_at')::timestamptz ELSE ownership_checked_at END,
  published_at=CASE WHEN p_action='publish' THEN now() ELSE published_at END
 WHERE id=r.id RETURNING * INTO r;
 INSERT INTO public.listing_review_events(review_id,actor_id,action,note) VALUES(r.id,p_actor,p_action,trim(p_note));
 RETURN r;
END $$;
-- SQL enforces the freeze even if a caller bypasses a disabled editor or races a media request.
CREATE FUNCTION private.guard_reviewed_draft() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE target uuid;
BEGIN
 IF TG_TABLE_NAME='listing_drafts' THEN target:=OLD.id;
 ELSIF TG_OP='DELETE' THEN target:=OLD.draft_id;
 ELSE
  IF TG_OP='UPDATE' AND (NEW.draft_id<>OLD.draft_id OR NEW.seller_id<>OLD.seller_id OR NEW.id<>OLD.id) THEN RAISE EXCEPTION 'Draft asset identity is immutable';END IF;
  target:=NEW.draft_id;
 END IF;
 PERFORM id FROM public.listing_drafts WHERE id=target FOR UPDATE;
 IF EXISTS(SELECT 1 FROM public.listing_reviews WHERE draft_id=target AND state IN ('preparing','in_review','approved','published')) THEN RAISE EXCEPTION 'Withdraw or unpublish the reviewed version before changing the draft';END IF;
 IF TG_OP='DELETE' THEN RETURN OLD;END IF;RETURN NEW;
END $$;
CREATE TRIGGER freeze_reviewed_draft BEFORE UPDATE OR DELETE ON public.listing_drafts FOR EACH ROW EXECUTE FUNCTION private.guard_reviewed_draft();
CREATE TRIGGER freeze_reviewed_assets BEFORE INSERT OR UPDATE OR DELETE ON public.listing_assets FOR EACH ROW EXECUTE FUNCTION private.guard_reviewed_draft();
CREATE FUNCTION private.guard_review_snapshot() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE status text;
BEGIN
 IF TG_OP='UPDATE' AND (NEW.review_id<>OLD.review_id OR NEW.id<>OLD.id OR NEW.source_asset_id<>OLD.source_asset_id OR NEW.path<>OLD.path) THEN RAISE EXCEPTION 'Snapshot attachment identity is immutable';END IF;
 SELECT state INTO status FROM public.listing_reviews WHERE id=CASE WHEN TG_OP='DELETE' THEN OLD.review_id ELSE NEW.review_id END FOR UPDATE;
 IF status IS DISTINCT FROM 'preparing' THEN RAISE EXCEPTION 'Reviewed attachments are immutable';END IF;
 IF TG_OP='DELETE' THEN RETURN OLD;END IF;RETURN NEW;
END $$;
CREATE TRIGGER freeze_review_snapshot_assets BEFORE INSERT OR UPDATE OR DELETE ON public.listing_review_assets FOR EACH ROW EXECUTE FUNCTION private.guard_review_snapshot();
REVOKE ALL ON FUNCTION public.reserve_listing_review(uuid,uuid,uuid,timestamptz,jsonb,boolean),public.transition_listing_review(uuid,uuid,integer,text,text,boolean,jsonb),private.guard_reviewed_draft(),private.guard_review_snapshot() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_listing_review(uuid,uuid,uuid,timestamptz,jsonb,boolean),public.transition_listing_review(uuid,uuid,integer,text,text,boolean,jsonb),private.guard_reviewed_draft(),private.guard_review_snapshot() TO service_role;
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types) VALUES('bestottr-review-assets','bestottr-review-assets',false,52428800,ARRAY['image/jpeg','image/png','image/webp','application/octet-stream']);

CREATE FUNCTION private.immutable_review_record() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF NEW.snapshot IS DISTINCT FROM OLD.snapshot OR NEW.seller_id<>OLD.seller_id OR NEW.id<>OLD.id OR NEW.rights_confirmed_at<>OLD.rights_confirmed_at THEN RAISE EXCEPTION 'Review identity and content are immutable';END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER immutable_review_record BEFORE UPDATE ON public.listing_reviews FOR EACH ROW EXECUTE FUNCTION private.immutable_review_record();
REVOKE ALL ON FUNCTION private.immutable_review_record() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.immutable_review_record() TO service_role;
