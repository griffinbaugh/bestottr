// @vitest-environment node
import { it, expect, vi } from "vitest";
import { verifyTrustapIdentity, TRUSTAP_SSO, oauthConfig } from "./trustap-oauth.server";
import { newOAuthFlow, sealFlow, openFlow, base64url } from "./oauth-state.server";
async function fixture(patch: Record<string, unknown> = {}) {
  const pair = await crypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["sign", "verify"],
  );
  const encode = (v: unknown) => base64url(new TextEncoder().encode(JSON.stringify(v)));
  const header = encode({ alg: "RS256", kid: "test" }),
    payload = encode({
      sub: "12345678-1234-4234-8234-123456789012",
      iss: "https://sso.trustap.com/auth/realms/trustap-stage",
      aud: "cid_test",
      nonce: "nonce",
      iat: Date.now() / 1000,
      exp: Date.now() / 1000 + 300,
      ...patch,
    });
  const sig = base64url(
    new Uint8Array(
      await crypto.subtle.sign(
        "RSASSA-PKCS1-v1_5",
        pair.privateKey,
        new TextEncoder().encode(header + "." + payload),
      ),
    ),
  );
  const jwk = await crypto.subtle.exportKey("jwk", pair.publicKey);
  return {
    jwt: header + "." + payload + "." + sig,
    request: vi
      .fn()
      .mockResolvedValue(Response.json({ keys: [{ ...jwk, kid: "test", alg: "RS256" }] })),
  };
}
it("verifies the signature, subject and fixed sandbox issuer", async () => {
  const f = await fixture();
  expect(await verifyTrustapIdentity(f.jwt, "nonce", "cid_test", f.request)).toBe(
    "12345678-1234-4234-8234-123456789012",
  );
  expect(f.request.mock.calls[0]![0]).toBe(TRUSTAP_SSO + "/certs");
});
it.each([
  { nonce: "other" },
  { aud: "other" },
  { iss: "https://sso.trustap.com/auth/realms/trustap" },
  { exp: 1 },
  { azp: "other" },
  { aud: ["cid_test", "other"] },
])("rejects invalid OAuth claims %j", async (patch) => {
  const f = await fixture(patch);
  await expect(verifyTrustapIdentity(f.jwt, "nonce", "cid_test", f.request)).rejects.toThrow();
});
it("rejects a tampered signed payload", async () => {
  const f = await fixture();
  const parts = f.jwt.split(".");
  parts[1] = base64url(new TextEncoder().encode(JSON.stringify({ sub: "attacker" })));
  await expect(
    verifyTrustapIdentity(parts.join("."), "nonce", "cid_test", f.request),
  ).rejects.toThrow("signature");
});
it("isolates Trustap cookies from the Roblox protocol", async () => {
  const secret = "test secret with at least thirty two characters",
    { flow } = await newOAuthFlow("private-access-token-example");
  const sealed = await sealFlow(flow, secret, "bestottr-trustap-v1");
  expect(await openFlow(sealed, secret, Date.now(), "bestottr-trustap-v1")).toEqual(flow);
  await expect(openFlow(sealed, secret)).rejects.toThrow();
});
it("does not accept live OAuth secrets for the sandbox", () => {
  expect(() =>
    oauthConfig({
      TRUSTAP_SANDBOX_ENABLED: "true",
      TRUSTAP_CLIENT_ID: "cid",
      TRUSTAP_SANDBOX_CLIENT_SECRET: "cs_live",
      TRUSTAP_OAUTH_STATE_SECRET: "x".repeat(32),
    }),
  ).toThrow();
});
