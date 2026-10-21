-- Private preparation only: no public listing state, bids, balances, payments or client-certified ownership.
CREATE TABLE public.listing_drafts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 seller_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 kind text NOT NULL CHECK (kind IN ('experience','community')),
 asset_id text NOT NULL CHECK (asset_id ~ '^[1-9][0-9]{0,18}$'),
 place_id text CHECK (place_id ~ '^[1-9][0-9]{0,18}$'),
 roblox_user_id text NOT NULL CHECK (roblox_user_id ~ '^[1-9][0-9]{0,19}$'),
 creator_type text NOT NULL CHECK (creator_type IN ('User','Group')),
 creator_id text NOT NULL CHECK (creator_id ~ '^[1-9][0-9]{0,18}$'),
 asset_name text NOT NULL CHECK (char_length(asset_name) BETWEEN 1 AND 200),
 title text NOT NULL CHECK (char_length(trim(title)) BETWEEN 3 AND 120),
 description text NOT NULL DEFAULT '' CHECK (char_length(description)<=10000),
 format text NOT NULL CHECK (format IN ('buy_now','auction')),
 price_cents bigint NOT NULL DEFAULT 0 CHECK (price_cents BETWEEN 0 AND 99999999999),
 reserve_cents bigint CHECK (reserve_cents BETWEEN price_cents AND 99999999999),
 ownership_checked_at timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (seller_id,kind,asset_id),
 CHECK ((kind='experience' AND place_id IS NOT NULL) OR (kind='community' AND place_id IS NULL AND creator_type='Group')),
 CHECK (format='auction' OR reserve_cents IS NULL)
);
ALTER TABLE public.listing_drafts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.listing_drafts FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.listing_drafts TO authenticated;
GRANT ALL ON public.listing_drafts TO service_role;
CREATE POLICY "Owner reads listing drafts" ON public.listing_drafts FOR SELECT TO authenticated
 USING (seller_id=(select auth.uid()) AND (select private.account_aal_allowed()));
CREATE TRIGGER listing_draft_updated BEFORE UPDATE ON public.listing_drafts
 FOR EACH ROW EXECUTE FUNCTION private.touch_account();
