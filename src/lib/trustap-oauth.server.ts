import { z } from "zod";
import type { OAuthFlow } from "./oauth-state.server";
export const TRUSTAP_SSO =
  "https://sso.trustap.com/auth/realms/trustap-stage/protocol/openid-connect";
export function oauthConfig(env = process.env) {
  const clientId = env["TRUSTAP_CLIENT_ID"],
    secret = env["TRUSTAP_SANDBOX_CLIENT_SECRET"],
    stateSecret = env["TRUSTAP_OAUTH_STATE_SECRET"];
  if (
    env["TRUSTAP_SANDBOX_ENABLED"] !== "true" ||
    !clientId ||
    !secret?.startsWith("cs_test_") ||
    !stateSecret ||
    stateSecret.length < 32
  )
    throw new Error("Trustap sandbox connection is not configured.");
  return { clientId, secret, stateSecret };
}
const decode = (s: string) =>
  Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
/** Validate the signed ID token, rather than trusting decoded browser or token-response claims. */
export async function verifyTrustapIdentity(
  jwt: string,
  nonce: string,
  clientId: string,
  request: typeof fetch = fetch,
) {
  if (jwt.length > 20000) throw new Error("Invalid Trustap identity.");
  const parts = jwt.split(".");
  if (parts.length !== 3) throw new Error("Invalid Trustap identity.");
  const header = z
    .object({ alg: z.literal("RS256"), kid: z.string() })
    .parse(JSON.parse(new TextDecoder().decode(decode(parts[0]!))));
  const r = await request(TRUSTAP_SSO + "/certs", {
    redirect: "manual",
    signal: AbortSignal.timeout(8000),
  });
  if (!r.ok) throw new Error("Trustap signing keys unavailable.");
  const keys = (await r.json()) as { keys: (JsonWebKey & { kid?: string; alg?: string })[] };
  const jwk = keys.keys?.find((k) => k.kid === header.kid && k.kty === "RSA" && k.alg === "RS256");
  if (!jwk) throw new Error("Unknown Trustap signing key.");
  const key = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );
  if (
    !(await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      key,
      decode(parts[2]!),
      new TextEncoder().encode(parts[0] + "." + parts[1]),
    ))
  )
    throw new Error("Invalid Trustap signature.");
  const claims = z
    .object({
      sub: z.string().uuid(),
      iss: z.literal("https://sso.trustap.com/auth/realms/trustap-stage"),
      aud: z.union([z.string(), z.array(z.string())]),
      azp: z.string().optional(),
      nonce: z.string(),
      exp: z.number(),
      iat: z.number(),
    })
    .parse(JSON.parse(new TextDecoder().decode(decode(parts[1]!))));
  if (
    !(Array.isArray(claims.aud) ? claims.aud : [claims.aud]).includes(clientId) ||
    claims.nonce !== nonce ||
    claims.exp <= Date.now() / 1000 ||
    claims.iat > Date.now() / 1000 + 60 ||
    (claims.azp && claims.azp !== clientId) ||
    (Array.isArray(claims.aud) && claims.aud.length > 1 && claims.azp !== clientId)
  )
    throw new Error("Trustap identity has expired or does not match this connection.");
  return claims.sub;
}
export async function completeTrustapConnection(
  flow: OAuthFlow,
  code: string,
  origin: string,
  request: typeof fetch = fetch,
) {
  const config = oauthConfig();
  const r = await request(TRUSTAP_SSO + "/token", {
    method: "POST",
    redirect: "manual",
    signal: AbortSignal.timeout(8000),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.secret,
      grant_type: "authorization_code",
      code,
      code_verifier: flow.verifier,
      redirect_uri: origin + "/api/trustap/callback",
    }),
  });
  if (!r.ok) throw new Error("Trustap connection exchange failed.");
  const tokens = z.object({ id_token: z.string() }).parse(await r.json());
  const sub = await verifyTrustapIdentity(tokens.id_token, flow.state, config.clientId, request);
  // Store identity only. No OAuth credentials or refresh tokens are retained.
  return sub;
}
