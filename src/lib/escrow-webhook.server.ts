import { sandboxConfig } from "./escrow-provider.server";
import { sandboxWebhook } from "./escrow-sandbox.server";
export async function handleSandboxWebhook(request: Request) {
  try {
    sandboxConfig();
  } catch {
    return new Response("Sandbox disabled", { status: 503 });
  }
  if (Number(request.headers.get("content-length")) > 2048)
    return new Response("Too large", { status: 413 });
  let body = "";
  try {
    const reader = request.body?.getReader();
    if (!reader) return new Response("Missing body", { status: 400 });
    let size = 0;
    const decoder = new TextDecoder();
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > 2048) {
        await reader.cancel();
        return new Response("Too large", { status: 413 });
      }
      body += decoder.decode(part.value, { stream: true });
    }
    body += decoder.decode();
  } catch {
    return new Response("Invalid body", { status: 400 });
  }
  let event: unknown;
  try {
    event = JSON.parse(body);
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }
  try {
    await sandboxWebhook(event);
    return new Response(null, { status: 204 });
  } catch {
    return new Response("Status could not be verified; retry", { status: 503 });
  }
}
