import { z } from "zod";
const flowSchema = z.object({
  state: z.string().uuid(),
  verifier: z.string().min(43).max(128),
  token: z.string().min(20).max(10000),
  expires: z.number(),
});
export type OAuthFlow = z.infer<typeof flowSchema>;
const enc = new TextEncoder();
export const base64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
const unbase64 = (text: string) =>
  Uint8Array.from(atob(text.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
async function key(secret: string) {
  if (secret.length < 32) throw new Error("OAuth is not configured.");
  return crypto.subtle.importKey(
    "raw",
    await crypto.subtle.digest("SHA-256", enc.encode(secret)),
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"],
  );
}
export async function sealFlow(flow: OAuthFlow, secret: string, context = "bestottr-roblox-v1") {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv, additionalData: enc.encode(context) },
      await key(secret),
      enc.encode(JSON.stringify(flow)),
    ),
  );
  const bytes = new Uint8Array(iv.length + cipher.length);
  bytes.set(iv);
  bytes.set(cipher, iv.length);
  return base64url(bytes);
}
export async function openFlow(
  value: string,
  secret: string,
  now = Date.now(),
  context = "bestottr-roblox-v1",
) {
  if (value.length > 20000) throw new Error("Invalid flow.");
  const bytes = unbase64(value);
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: bytes.slice(0, 12), additionalData: enc.encode(context) },
    await key(secret),
    bytes.slice(12),
  );
  const flow = flowSchema.parse(JSON.parse(new TextDecoder().decode(plain)));
  if (flow.expires < now || flow.expires > now + 10 * 60_000) throw new Error("Flow expired.");
  return flow;
}
export async function newOAuthFlow(token: string): Promise<{ flow: OAuthFlow; challenge: string }> {
  const verifier = base64url(crypto.getRandomValues(new Uint8Array(32)));
  return {
    flow: { token, verifier, state: crypto.randomUUID(), expires: Date.now() + 5 * 60_000 },
    challenge: base64url(
      new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(verifier))),
    ),
  };
}
