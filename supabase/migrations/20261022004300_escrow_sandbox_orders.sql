-- Isolated sandbox records. These tables cannot represent live orders or move real funds.
CREATE TABLE public.escrow_sandbox_orders (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 request_id uuid NOT NULL,
 reference text NOT NULL UNIQUE CHECK(reference ~ '^bt_[a-f0-9]{20}$'),
 mode text NOT NULL DEFAULT 'sandbox' CHECK(mode='sandbox'),
 seller_id uuid NOT NULL REFERENCES public.profiles(id),
 buyer_id uuid NOT NULL REFERENCES public.profiles(id),
 draft_id uuid REFERENCES public.listing_drafts(id) ON DELETE SET NULL,
 title text NOT NULL CHECK(char_length(title) BETWEEN 3 AND 120),
 kind text NOT NULL CHECK(kind IN ('experience','community','file')),
 amount_cents bigint NOT NULL CHECK(amount_cents BETWEEN 1 AND 99999999999),
 currency text NOT NULL DEFAULT 'usd' CHECK(currency='usd'),
 inspection_seconds integer NOT NULL DEFAULT 259200 CHECK(inspection_seconds BETWEEN 86400 AND 2592000),
 buyer_email text NOT NULL CHECK(char_length(buyer_email)<=254),
 seller_email text NOT NULL CHECK(char_length(seller_email)<=254),
 asset_id text,
 roblox_url text NOT NULL DEFAULT '',
 target_roblox_id text,
 state text NOT NULL DEFAULT 'preparing' CHECK(state IN ('preparing','creating','creation_uncertain','awaiting_agreement','awaiting_funding','funded','inspection','completed','cancelled','refunded','review')),
 provider_id text UNIQUE CHECK(provider_id ~ '^[1-9][0-9]{0,18}$'),
 checkout_url text,
 provider_summary jsonb NOT NULL DEFAULT '{}',
 checked_at timestamptz,
 last_error text,
 sync_claim uuid,
 last_sync_attempt_at timestamptz,
 ownership_checked_at timestamptz,
 ownership_matches boolean,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(seller_id,request_id),
 CHECK(seller_id<>buyer_id),
 CHECK(lower(buyer_email)<>lower(seller_email)),
 CHECK((kind='file' AND target_roblox_id IS NULL AND asset_id IS NULL) OR (kind<>'file' AND target_roblox_id IS NOT NULL AND asset_id IS NOT NULL AND target_roblox_id ~ '^[1-9][0-9]{0,19}$' AND asset_id ~ '^[1-9][0-9]{0,18}$'))
);
CREATE INDEX escrow_sandbox_buyer_idx ON public.escrow_sandbox_orders(buyer_id,created_at DESC);
CREATE INDEX escrow_sandbox_seller_idx ON public.escrow_sandbox_orders(seller_id,created_at DESC);
CREATE INDEX escrow_sandbox_draft_idx ON public.escrow_sandbox_orders(draft_id);
CREATE TABLE public.escrow_sandbox_files (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 order_id uuid NOT NULL REFERENCES public.escrow_sandbox_orders(id) ON DELETE CASCADE,
 filename text NOT NULL,
 size_bytes bigint NOT NULL CHECK(size_bytes>0 AND size_bytes<=52428800),
 path text NOT NULL UNIQUE,
 ready boolean NOT NULL DEFAULT false,
 CHECK(path=order_id::text||'/'||id::text)
);
CREATE INDEX escrow_sandbox_files_order_idx ON public.escrow_sandbox_files(order_id);
CREATE TABLE public.escrow_sandbox_events (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 order_id uuid NOT NULL REFERENCES public.escrow_sandbox_orders(id) ON DELETE CASCADE,
 state text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX escrow_sandbox_events_order_idx ON public.escrow_sandbox_events(order_id,created_at);
ALTER TABLE public.escrow_sandbox_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escrow_sandbox_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escrow_sandbox_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.escrow_sandbox_orders,public.escrow_sandbox_files,public.escrow_sandbox_events FROM PUBLIC,anon,authenticated;
GRANT SELECT(id,request_id,reference,mode,seller_id,buyer_id,draft_id,title,kind,amount_cents,currency,inspection_seconds,asset_id,roblox_url,target_roblox_id,state,provider_id,checked_at,last_error,last_sync_attempt_at,ownership_checked_at,ownership_matches,created_at,updated_at) ON public.escrow_sandbox_orders TO authenticated;
GRANT SELECT ON public.escrow_sandbox_events TO authenticated;
GRANT ALL ON public.escrow_sandbox_orders,public.escrow_sandbox_files,public.escrow_sandbox_events TO service_role;
GRANT USAGE,SELECT ON SEQUENCE public.escrow_sandbox_events_id_seq TO service_role;
CREATE POLICY "Sandbox participants read orders" ON public.escrow_sandbox_orders FOR SELECT TO authenticated USING ((seller_id=(select auth.uid()) OR buyer_id=(select auth.uid())) AND (select private.account_aal_allowed()));
CREATE POLICY "Sandbox participants read events" ON public.escrow_sandbox_events FOR SELECT TO authenticated USING (EXISTS(SELECT 1 FROM public.escrow_sandbox_orders o WHERE o.id=order_id AND (o.seller_id=(select auth.uid()) OR o.buyer_id=(select auth.uid()))) AND (select private.account_aal_allowed()));
-- File paths have no client grants or policies. Only authorized server downloads sign URLs.
CREATE FUNCTION public.claim_escrow_sandbox_sync(p_order uuid,p_force boolean DEFAULT false) RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE claim uuid:=gen_random_uuid();
BEGIN
 UPDATE public.escrow_sandbox_orders SET sync_claim=claim,last_sync_attempt_at=now()
 WHERE id=p_order AND (sync_claim IS NULL OR last_sync_attempt_at<now()-interval '30 seconds')
 AND (p_force OR last_sync_attempt_at IS NULL OR last_sync_attempt_at<now()-interval '15 seconds');
 IF FOUND THEN RETURN claim;END IF;RETURN NULL;
END $$;
CREATE FUNCTION public.commit_escrow_sandbox_sync(p_order uuid,p_claim uuid,p_state text,p_summary jsonb) RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE previous text;
BEGIN
 SELECT state INTO previous FROM public.escrow_sandbox_orders WHERE id=p_order AND sync_claim=p_claim FOR UPDATE;
 IF NOT FOUND THEN RETURN false; END IF;
 UPDATE public.escrow_sandbox_orders SET state=p_state,provider_summary=p_summary,checked_at=now(),updated_at=now(),sync_claim=NULL,last_error=NULL WHERE id=p_order;
 IF previous<>p_state THEN INSERT INTO public.escrow_sandbox_events(order_id,state) VALUES(p_order,p_state); END IF;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.claim_escrow_sandbox_sync(uuid,boolean),public.commit_escrow_sandbox_sync(uuid,uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_escrow_sandbox_sync(uuid,boolean),public.commit_escrow_sandbox_sync(uuid,uuid,text,jsonb) TO service_role;
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types) VALUES ('bestottr-sandbox-deliverables','bestottr-sandbox-deliverables',false,52428800,ARRAY['application/octet-stream']);
CREATE UNIQUE INDEX escrow_sandbox_active_order_idx ON public.escrow_sandbox_orders(seller_id,buyer_id,draft_id) WHERE state NOT IN ('cancelled','refunded','completed');
