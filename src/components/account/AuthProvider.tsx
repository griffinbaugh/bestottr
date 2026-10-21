import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Profile, Preferences, RobloxAccount } from "@/lib/account";

type AuthState = {
  session: Session | null;
  loading: boolean;
  profile: Profile | null;
  preferences: Preferences | null;
  roblox: RobloxAccount | null;
  isAdmin: boolean;
  accountError: string | null;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};
const Context = createContext<AuthState>({
  session: null,
  loading: true,
  profile: null,
  preferences: null,
  roblox: null,
  isAdmin: false,
  accountError: null,
  refresh: async () => {},
  signOut: async () => {},
});
export const useAuth = () => useContext(Context);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [preferences, setPreferences] = useState<Preferences | null>(null);
  const [roblox, setRoblox] = useState<RobloxAccount | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [accountError, setAccountError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      if (alive) {
        setSession(next);
        setLoading(false);
      }
    });
    void supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (alive) {
          setSession(data.session);
          setLoading(false);
          if (error) setAccountError("Your session could not be loaded. Please sign in again.");
        }
      })
      .catch(() => {
        if (alive) {
          setLoading(false);
          setAccountError("Authentication is unavailable. Please try again.");
        }
      });
    return () => {
      alive = false;
      data.subscription.unsubscribe();
    };
  }, []);
  // Do not await other Supabase operations inside the auth change callback.
  const refresh = useCallback(async () => {
    if (!session) return;
    const [p, pref, r, role] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", session.user.id).single(),
      supabase.from("account_preferences").select("*").eq("user_id", session.user.id).single(),
      supabase.from("roblox_accounts").select("*").eq("user_id", session.user.id).maybeSingle(),
      supabase.rpc("has_role", { _user_id: session.user.id, _role: "admin" }),
    ]);
    const current = await supabase.auth.getSession();
    if (current.data.session?.user.id !== session.user.id) return;
    setProfile(p.data);
    setPreferences(pref.data);
    setRoblox(r.data);
    setIsAdmin(role.data === true);
    setAccountError(
      p.error || pref.error || r.error || role.error
        ? "Some account information could not be loaded. Try again before making changes."
        : null,
    );
  }, [session]);
  useEffect(() => {
    setProfile(null);
    setPreferences(null);
    setRoblox(null);
    setIsAdmin(false);
    setAccountError(null);
    if (session)
      void refresh().catch(() =>
        setAccountError("Account information is temporarily unavailable."),
      );
  }, [refresh, session]);
  const signOut = async () => {
    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (error) throw error;
    setProfile(null);
    setPreferences(null);
    setRoblox(null);
    setIsAdmin(false);
    window.location.assign("/login");
  };
  return (
    <Context.Provider
      value={{
        session,
        loading,
        profile,
        preferences,
        roblox,
        isAdmin,
        accountError,
        refresh,
        signOut,
      }}
    >
      {children}
    </Context.Provider>
  );
}
