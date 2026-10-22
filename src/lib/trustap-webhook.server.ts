import { sandboxConfig } from "./trustap-provider.server";
async function secretMatches(actual: string | null, expected: string) {
  const enc = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(actual ?? "")),
    crypto.subtle.digest("SHA-256", enc.encode(expected)),
  ]);
  const av = new Uint8Array(a),
    bv = new Uint8Array(b);
  let diff = 0;
  for (let i = 0; i < av.length; i++) diff |= av[i]! ^ bv[i]!;
  return diff === 0;
}
export async function handleTrustapWebhook(request: Request) {
  try {
    sandboxConfig();
  } catch {
    return new Response(null, { status: 503 });
  }
  const user = process.env["TRUSTAP_WEBHOOK_USER"],
    password = process.env["TRUSTAP_WEBHOOK_PASSWORD"];
  if (!user || !password || password.length < 32) return new Response(null, { status: 503 });
  if (
    !(await secretMatches(
      request.headers.get("authorization"),
      "Basic " + btoa(user + ":" + password),
    ))
  )
    return new Response(null, { status: 401 });
  if (Number(request.headers.get("content-length")) > 32768)
    return new Response(null, { status: 413 });
  const reader = request.body?.getReader();
  if (!reader) return new Response(null, { status: 400 });
  let size = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 32768) {
      await reader.cancel();
      return new Response(null, { status: 413 });
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const c of chunks) {
    bytes.set(c, offset);
    offset += c.length;
  }
  let raw: unknown;
  try {
    raw = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return new Response(null, { status: 400 });
  }
  try {
    const { sandboxWebhook } = await import("./trustap-sandbox.server");
    await sandboxWebhook(raw);
    return new Response(null, { status: 204 });
  } catch {
    return new Response(null, { status: 503 });
  }
}
export async function handleTrustapSync(request: Request) {
  const secret = process.env["TRUSTAP_SYNC_SECRET"];
  if (!secret || secret.length < 32) return new Response(null, { status: 503 });
  if (!(await secretMatches(request.headers.get("authorization"), "Bearer " + secret)))
    return new Response(null, { status: 401 });
  try {
    const { reconcileSandboxBatch } = await import("./trustap-sandbox.server");
    return Response.json(await reconcileSandboxBatch(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return new Response(null, { status: 503 });
  }
}
