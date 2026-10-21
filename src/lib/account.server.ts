import { createClient } from "@supabase/supabase-js";
export const siteOrigin = () => {
  const raw = process.env["SITE_URL"] || "https://bestottr.com";
  const url = new URL(raw);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  )
    throw new Error("Site URL is not configured correctly.");
  return url.origin;
};
export async function verifiedAccount(token: string) {
  const url = process.env["SUPABASE_URL"],
    key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) throw new Error("Authentication is not configured.");
  const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data.user || !data.user.email_confirmed_at)
    throw new Error("Sign in with a verified email address first.");
  const verified = data.user.factors?.some((f) => f.status === "verified");
  if (verified) {
    const { data: claims, error } = await sb.auth.getClaims(token);
    if (error || claims?.claims.aal !== "aal2")
      throw new Error("Complete two-step verification first.");
  }
  return data.user;
}
export const robloxConfigured = () =>
  !!(
    process.env["ROBLOX_CLIENT_ID"] &&
    process.env["ROBLOX_CLIENT_SECRET"] &&
    process.env["ROBLOX_OAUTH_STATE_SECRET"] &&
    process.env["ROBLOX_OAUTH_STATE_SECRET"].length >= 32 &&
    process.env["SUPABASE_SERVICE_ROLE_KEY"]
  );
