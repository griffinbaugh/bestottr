import type { SupabaseClient } from "@supabase/supabase-js";
import { safeReturnTo } from "./account";

// The callback page owns code/token processing. Automatic URL detection races
// with the page and can consume a single-use code before its explicit exchange.
export const EMAIL_AUTH_OPTIONS = {
  flowType: "pkce",
  detectSessionInUrl: false,
  persistSession: true,
  autoRefreshToken: true,
} as const;

export type CallbackAuth = Pick<
  SupabaseClient["auth"],
  "exchangeCodeForSession" | "verifyOtp" | "setSession" | "getSession"
>;

export async function completeEmailCallback(auth: CallbackAuth, url: URL): Promise<string> {
  const hash = new URLSearchParams(url.hash.slice(1));
  const type = url.searchParams.get("type") ?? hash.get("type");
  if (url.searchParams.has("error") || hash.has("error"))
    throw new Error("Invalid or expired link.");
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  if (code) {
    const flowId = url.searchParams.get("sb_flow_id");
    const { error } = await auth.exchangeCodeForSession(code, flowId ? { flowId } : undefined);
    if (error) throw error;
  } else if (tokenHash) {
    if (!["signup", "recovery", "email_change", "email"].includes(type ?? ""))
      throw new Error("Unsupported confirmation link.");
    const { error } = await auth.verifyOtp({
      token_hash: tokenHash,
      type: type as "signup" | "recovery" | "email_change" | "email",
    });
    if (error) throw error;
  } else if (hash.has("access_token") || hash.has("refresh_token")) {
    const access_token = hash.get("access_token"),
      refresh_token = hash.get("refresh_token");
    if (!access_token || !refresh_token) throw new Error("Incomplete authentication link.");
    const { error } = await auth.setSession({ access_token, refresh_token });
    if (error) throw error;
  } else {
    throw new Error("No confirmation or recovery credentials in this link.");
  }
  const { data, error } = await auth.getSession();
  if (error || !data.session) throw new Error("Your sign-in session could not be restored.");
  return type === "recovery" ? "/reset-password" : safeReturnTo(url.searchParams.get("next"));
}
