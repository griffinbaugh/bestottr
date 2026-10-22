-- Private listing preparation. No public listings, payment state, or buyer entitlements are opened.
ALTER TABLE public.listing_drafts
 DROP CONSTRAINT listing_drafts_kind_check,
 DROP CONSTRAINT listing_drafts_check1,
 ALTER COLUMN asset_id DROP NOT NULL,
 ALTER COLUMN roblox_user_id DROP NOT NULL,
 ALTER COLUMN creator_type DROP NOT NULL,
 ALTER COLUMN creator_id DROP NOT NULL,
 ALTER COLUMN ownership_checked_at DROP NOT NULL,
 ADD COLUMN auction_ends_at bigint CHECK (auction_ends_at BETWEEN 0 AND 8640000000000000),
 ADD CONSTRAINT listing_drafts_kind_check CHECK (kind IN ('experience','community','file')),
 ADD CONSTRAINT listing_drafts_identity_check CHECK (
  (kind='file' AND asset_id IS NULL AND place_id IS NULL AND roblox_user_id IS NULL AND creator_type IS NULL AND creator_id IS NULL AND ownership_checked_at IS NULL)
  OR (kind IN ('experience','community') AND asset_id IS NOT NULL AND roblox_user_id IS NOT NULL AND creator_type IS NOT NULL AND creator_id IS NOT NULL AND ownership_checked_at IS NOT NULL AND
    ((kind='experience' AND place_id IS NOT NULL) OR (kind='community' AND place_id IS NULL AND creator_type='Group')))
 ),
 ADD CONSTRAINT listing_drafts_schedule_check CHECK (format='auction' OR auction_ends_at IS NULL),
 ADD CONSTRAINT listing_drafts_id_seller_key UNIQUE(id,seller_id);

CREATE TABLE public.listing_assets (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 draft_id uuid NOT NULL,
 seller_id uuid NOT NULL,
 category text NOT NULL CHECK(category IN ('image','file')),
 filename text NOT NULL CHECK(char_length(filename) BETWEEN 1 AND 120 AND filename !~ '[/\\]'),
 content_type text NOT NULL,
 size_bytes bigint NOT NULL CHECK(size_bytes > 0 AND size_bytes <= 52428800),
 path text NOT NULL UNIQUE,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','ready')),
 position integer NOT NULL DEFAULT 0 CHECK(position >= 0),
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(draft_id,seller_id) REFERENCES public.listing_drafts(id,seller_id) ON DELETE CASCADE,
 CHECK(path = seller_id::text || '/' || draft_id::text || '/' || id::text),
 CHECK((category='image' AND size_bytes<=5242880 AND content_type IN ('image/jpeg','image/png','image/webp')) OR (category='file' AND content_type='application/octet-stream'))
);
CREATE INDEX listing_assets_draft_idx ON public.listing_assets(draft_id,position,created_at);
CREATE INDEX listing_assets_seller_idx ON public.listing_assets(seller_id);
ALTER TABLE public.listing_assets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.listing_assets FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.listing_assets TO authenticated;
GRANT ALL ON public.listing_assets TO service_role;
CREATE POLICY "Seller reads private assets" ON public.listing_assets FOR SELECT TO authenticated
 USING (seller_id=(select auth.uid()) AND (select private.account_aal_allowed()));
ALTER TABLE public.listing_drafts ADD COLUMN cover_asset_id uuid REFERENCES public.listing_assets(id) ON DELETE SET NULL;
CREATE INDEX listing_drafts_cover_idx ON public.listing_drafts(cover_asset_id) WHERE cover_asset_id IS NOT NULL;

-- Server-only RPC serializes reservations per seller to make quotas hold under parallel uploads.
CREATE FUNCTION public.reserve_listing_asset(p_seller uuid,p_draft uuid,p_category text,p_filename text,p_content_type text,p_size bigint)
RETURNS public.listing_assets LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE item public.listing_assets; asset_id uuid := gen_random_uuid();
BEGIN
 PERFORM id FROM public.profiles WHERE id=p_seller FOR UPDATE;
 IF NOT EXISTS(SELECT 1 FROM public.listing_drafts WHERE id=p_draft AND seller_id=p_seller) THEN RAISE EXCEPTION 'Draft not found'; END IF;
 IF (SELECT count(*) FROM public.listing_assets WHERE draft_id=p_draft AND category=p_category) >= (CASE WHEN p_category='image' THEN 8 ELSE 3 END) THEN RAISE EXCEPTION 'Draft upload limit reached'; END IF;
 IF (SELECT coalesce(sum(size_bytes),0) FROM public.listing_assets WHERE seller_id=p_seller)+p_size>157286400 THEN RAISE EXCEPTION 'Account upload limit reached'; END IF;
 INSERT INTO public.listing_assets(id,draft_id,seller_id,category,filename,content_type,size_bytes,path,position)
 VALUES(asset_id,p_draft,p_seller,p_category,p_filename,p_content_type,p_size,p_seller::text||'/'||p_draft::text||'/'||asset_id::text,
 coalesce((SELECT max(position)+1 FROM public.listing_assets WHERE draft_id=p_draft),0)) RETURNING * INTO item;
 RETURN item;
END $$;
REVOKE ALL ON FUNCTION public.reserve_listing_asset(uuid,uuid,text,text,text,bigint) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_listing_asset(uuid,uuid,text,text,text,bigint) TO service_role;

INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types) VALUES
 ('bestottr-draft-images','bestottr-draft-images',false,5242880,ARRAY['image/jpeg','image/png','image/webp']),
 ('bestottr-draft-files','bestottr-draft-files',false,52428800,ARRAY['application/octet-stream']);
-- No storage.objects policies: clients get scoped, non-upsert upload URLs after server authorization.
-- Reads are short-lived signed URLs after verified account + seller checks. No public bucket access.

-- Gallery changes are atomic and serialized with other gallery operations on the same seller.
CREATE FUNCTION public.move_listing_image(p_seller uuid,p_asset uuid,p_direction text)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE selected public.listing_assets; ordered uuid[]; old_index int; new_index int; other uuid;
BEGIN
 IF p_direction NOT IN ('earlier','later') THEN RAISE EXCEPTION 'Invalid direction'; END IF;
 PERFORM id FROM public.profiles WHERE id=p_seller FOR UPDATE;
 SELECT * INTO selected FROM public.listing_assets WHERE id=p_asset AND seller_id=p_seller AND category='image' AND status='ready';
 IF NOT FOUND THEN RAISE EXCEPTION 'Image not found'; END IF;
 SELECT array_agg(id ORDER BY position,created_at,id) INTO ordered FROM public.listing_assets WHERE draft_id=selected.draft_id AND seller_id=p_seller AND category='image' AND status='ready';
 old_index:=array_position(ordered,p_asset);
 new_index:=old_index+CASE WHEN p_direction='earlier' THEN -1 ELSE 1 END;
 IF new_index<1 OR new_index>array_length(ordered,1) THEN RETURN; END IF;
 other:=ordered[new_index]; ordered[new_index]:=p_asset; ordered[old_index]:=other;
 UPDATE public.listing_assets SET position=array_position(ordered,id)-1 WHERE id=ANY(ordered) AND seller_id=p_seller;
END $$;
REVOKE ALL ON FUNCTION public.move_listing_image(uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.move_listing_image(uuid,uuid,text) TO service_role;
