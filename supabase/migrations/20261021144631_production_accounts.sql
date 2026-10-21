-- Accounts contain no payment card details, bank details, provider secrets or user-controlled verification flags.
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

CREATE TABLE public.profiles (
 id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 display_name text NOT NULL CHECK (char_length(display_name) BETWEEN 2 AND 60),
 handle text NOT NULL UNIQUE CHECK (handle ~ '^[a-z0-9][a-z0-9_]{2,29}$' AND handle NOT IN ('admin','administrator','support','bestottr','moderator','system','staff')),
 bio text NOT NULL DEFAULT '' CHECK (char_length(bio) <= 500),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.account_preferences (
 user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 email_bids boolean NOT NULL DEFAULT true, email_listings boolean NOT NULL DEFAULT true, email_news boolean NOT NULL DEFAULT false,
 currency text NOT NULL DEFAULT 'USD' CHECK (currency='USD'),
 timezone text NOT NULL DEFAULT 'America/New_York' CHECK (char_length(timezone) BETWEEN 1 AND 64),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.roblox_accounts (
 user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 roblox_user_id text NOT NULL UNIQUE CHECK (roblox_user_id ~ '^[0-9]{1,20}$'),
 username text NOT NULL CHECK (char_length(username) BETWEEN 1 AND 64),
 display_name text NOT NULL CHECK (char_length(display_name) BETWEEN 1 AND 100),
 verified_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE private.payment_accounts (
 user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 stripe_customer_id text UNIQUE,
 updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roblox_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.payment_accounts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.profiles,public.account_preferences,public.roblox_accounts FROM PUBLIC,anon,authenticated;
REVOKE ALL ON private.payment_accounts FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.profiles,public.account_preferences,public.roblox_accounts,private.payment_accounts TO service_role;
GRANT SELECT ON public.profiles TO anon,authenticated;
GRANT UPDATE (display_name,handle,bio) ON public.profiles TO authenticated;
GRANT SELECT ON public.account_preferences,public.roblox_accounts TO authenticated;
GRANT UPDATE (email_bids,email_listings,email_news,currency,timezone) ON public.account_preferences TO authenticated;

-- Internal trigger. No client may execute it or choose the ID of another user.
CREATE FUNCTION private.bootstrap_account() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE label text;
BEGIN
 label := left(trim(coalesce(NEW.raw_user_meta_data->>'display_name','Member')),60);
 IF char_length(label)<2 THEN label := 'Member'; END IF;
 INSERT INTO public.profiles(id,display_name,handle) VALUES (NEW.id,label,'member_'||left(replace(NEW.id::text,'-',''),23)) ON CONFLICT(id) DO NOTHING;
 INSERT INTO public.account_preferences(user_id) VALUES (NEW.id) ON CONFLICT(user_id) DO NOTHING;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.bootstrap_account() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER bestottr_account_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION private.bootstrap_account();
INSERT INTO public.profiles(id,display_name,handle) SELECT id,'Member','member_'||left(replace(id::text,'-',''),23) FROM auth.users ON CONFLICT(id) DO NOTHING;
INSERT INTO public.account_preferences(user_id) SELECT id FROM auth.users ON CONFLICT(user_id) DO NOTHING;

CREATE FUNCTION private.account_aal_allowed() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL AND (
  NOT EXISTS (SELECT 1 FROM auth.mfa_factors f WHERE f.user_id=auth.uid() AND f.status='verified')
  OR (auth.jwt()->>'aal')='aal2'
 )
$$;
REVOKE ALL ON FUNCTION private.account_aal_allowed() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.account_aal_allowed() TO authenticated;
CREATE POLICY "Public profile directory" ON public.profiles FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY "Owner updates profile" ON public.profiles FOR UPDATE TO authenticated USING (id=(select auth.uid()) AND (select private.account_aal_allowed())) WITH CHECK (id=(select auth.uid()) AND (select private.account_aal_allowed()));
CREATE POLICY "Owner reads preferences" ON public.account_preferences FOR SELECT TO authenticated USING (user_id=(select auth.uid()));
CREATE POLICY "Owner updates preferences" ON public.account_preferences FOR UPDATE TO authenticated USING (user_id=(select auth.uid()) AND (select private.account_aal_allowed())) WITH CHECK (user_id=(select auth.uid()) AND (select private.account_aal_allowed()));
CREATE POLICY "Owner reads Roblox link" ON public.roblox_accounts FOR SELECT TO authenticated USING (user_id=(select auth.uid()));
CREATE FUNCTION private.touch_account() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$ BEGIN NEW.updated_at=now(); RETURN NEW; END $$;
REVOKE ALL ON FUNCTION private.touch_account() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER profile_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION private.touch_account();
CREATE TRIGGER preferences_updated BEFORE UPDATE ON public.account_preferences FOR EACH ROW EXECUTE FUNCTION private.touch_account();
