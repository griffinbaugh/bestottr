-- Full Trustap identities are established only by server-verified OAuth.
CREATE TABLE public.trustap_sandbox_accounts (
 user_id uuid PRIMARY KEY REFERENCES public.profiles(id),
 provider_user_id uuid NOT NULL UNIQUE,
 connected_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.trustap_sandbox_accounts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.trustap_sandbox_accounts FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.trustap_sandbox_accounts TO service_role;
-- Intentional client-deny policies/grants: account and file paths are server-only.
-- Isolated sandbox records. These tables cannot represent live orders or move real funds.
CREATE TABLE public.trustap_sandbox_orders (
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
 buyer_provider_id uuid NOT NULL,
 seller_provider_id uuid NOT NULL,
 client_id text NOT NULL,
 fees_buyer bigint NOT NULL CHECK(fees_buyer>=0),
 fees_seller bigint NOT NULL CHECK(fees_seller>=0 AND fees_seller<=amount_cents),
 fees_config bigint NOT NULL CHECK(fees_config>=0),
 delivery_submitted_at timestamptz,
 asset_id text,
 roblox_url text NOT NULL DEFAULT '',
 target_roblox_id text,
 state text NOT NULL DEFAULT 'preparing' CHECK(state IN ('preparing','creating','creation_uncertain','awaiting_funding','funded','inspection','completed','cancelled','refunded','review')),
 provider_id text UNIQUE CHECK(provider_id ~ '^tx_[a-zA-Z0-9]{1,80}$'),
 checkout_url text,
 provider_summary jsonb NOT NULL DEFAULT '{}',
 checked_at timestamptz,
 last_error text,
 sync_claim uuid,
 sync_pending boolean NOT NULL DEFAULT false,
 last_sync_attempt_at timestamptz,
 ownership_checked_at timestamptz,
 ownership_matches boolean,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(seller_id,request_id),
 CHECK(seller_id<>buyer_id),
 CHECK(buyer_provider_id<>seller_provider_id),
 CHECK((kind='file' AND target_roblox_id IS NULL AND asset_id IS NULL) OR (kind<>'file' AND target_roblox_id IS NOT NULL AND asset_id IS NOT NULL AND target_roblox_id ~ '^[1-9][0-9]{0,19}$' AND asset_id ~ '^[1-9][0-9]{0,18}$'))
);
CREATE INDEX trustap_sandbox_buyer_idx ON public.trustap_sandbox_orders(buyer_id,created_at DESC);
CREATE INDEX trustap_sandbox_seller_idx ON public.trustap_sandbox_orders(seller_id,created_at DESC);
CREATE INDEX trustap_sandbox_draft_idx ON public.trustap_sandbox_orders(draft_id);
CREATE TABLE public.trustap_sandbox_files (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 order_id uuid NOT NULL REFERENCES public.trustap_sandbox_orders(id) ON DELETE CASCADE,
 filename text NOT NULL,
 size_bytes bigint NOT NULL CHECK(size_bytes>0 AND size_bytes<=52428800),
 path text NOT NULL UNIQUE,
 ready boolean NOT NULL DEFAULT false,
 CHECK(path=order_id::text||'/'||id::text)
);
CREATE INDEX trustap_sandbox_files_order_idx ON public.trustap_sandbox_files(order_id);
CREATE TABLE public.trustap_sandbox_events (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 order_id uuid NOT NULL REFERENCES public.trustap_sandbox_orders(id) ON DELETE CASCADE,
 state text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX trustap_sandbox_events_order_idx ON public.trustap_sandbox_events(order_id,created_at);
ALTER TABLE public.trustap_sandbox_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trustap_sandbox_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trustap_sandbox_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.trustap_sandbox_orders,public.trustap_sandbox_files,public.trustap_sandbox_events FROM PUBLIC,anon,authenticated;
GRANT SELECT(id,request_id,reference,mode,seller_id,buyer_id,draft_id,title,kind,amount_cents,currency,fees_buyer,fees_seller,asset_id,roblox_url,target_roblox_id,state,provider_id,checked_at,last_error,last_sync_attempt_at,ownership_checked_at,ownership_matches,delivery_submitted_at,created_at,updated_at) ON public.trustap_sandbox_orders TO authenticated;
GRANT SELECT ON public.trustap_sandbox_events TO authenticated;
GRANT ALL ON public.trustap_sandbox_orders,public.trustap_sandbox_files,public.trustap_sandbox_events TO service_role;
GRANT USAGE,SELECT ON SEQUENCE public.trustap_sandbox_events_id_seq TO service_role;
CREATE POLICY "Sandbox participants read orders" ON public.trustap_sandbox_orders FOR SELECT TO authenticated USING ((seller_id=(select auth.uid()) OR buyer_id=(select auth.uid())) AND (select private.account_aal_allowed()));
CREATE POLICY "Sandbox participants read events" ON public.trustap_sandbox_events FOR SELECT TO authenticated USING (EXISTS(SELECT 1 FROM public.trustap_sandbox_orders o WHERE o.id=order_id AND (o.seller_id=(select auth.uid()) OR o.buyer_id=(select auth.uid()))) AND (select private.account_aal_allowed()));
-- File paths have no client grants or policies. Only authorized server downloads sign URLs.
CREATE FUNCTION public.claim_trustap_sandbox_sync(p_order uuid,p_force boolean DEFAULT false) RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE claim uuid:=gen_random_uuid();
BEGIN
 UPDATE public.trustap_sandbox_orders SET sync_claim=claim,last_sync_attempt_at=now()
 WHERE id=p_order AND (sync_claim IS NULL OR last_sync_attempt_at<now()-interval '90 seconds')
 AND (p_force OR last_sync_attempt_at IS NULL OR last_sync_attempt_at<now()-interval '15 seconds');
 IF FOUND THEN RETURN claim;END IF;RETURN NULL;
END $$;
CREATE FUNCTION public.commit_trustap_sandbox_sync(p_order uuid,p_claim uuid,p_state text,p_summary jsonb) RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE previous text;
BEGIN
 SELECT state INTO previous FROM public.trustap_sandbox_orders WHERE id=p_order AND sync_claim=p_claim FOR UPDATE;
 IF NOT FOUND THEN RETURN false; END IF;
 UPDATE public.trustap_sandbox_orders SET state=p_state,provider_summary=p_summary,checked_at=now(),updated_at=now(),sync_claim=NULL,sync_pending=false,last_error=NULL WHERE id=p_order;
 IF previous<>p_state THEN INSERT INTO public.trustap_sandbox_events(order_id,state) VALUES(p_order,p_state); END IF;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.claim_trustap_sandbox_sync(uuid,boolean),public.commit_trustap_sandbox_sync(uuid,uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_trustap_sandbox_sync(uuid,boolean),public.commit_trustap_sandbox_sync(uuid,uuid,text,jsonb) TO service_role;
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types) VALUES ('bestottr-trustap-test-files','bestottr-trustap-test-files',false,52428800,ARRAY['application/octet-stream']);
CREATE UNIQUE INDEX trustap_sandbox_active_order_idx ON public.trustap_sandbox_orders(seller_id,buyer_id,draft_id) WHERE state NOT IN ('cancelled','refunded','completed');
