// @vitest-environment node
import { it, expect, vi, beforeEach } from "vitest";
const h = vi.hoisted(() => ({ webhook: vi.fn(), batch: vi.fn() }));
vi.mock("./trustap-sandbox.server", () => ({
  sandboxWebhook: h.webhook,
  reconcileSandboxBatch: h.batch,
}));
import { handleTrustapWebhook, handleTrustapSync } from "./trustap-webhook.server";
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("TRUSTAP_SANDBOX_ENABLED", "true");
  vi.stubEnv("TRUSTAP_SANDBOX_API_KEY", "capi_test_fake");
  vi.stubEnv("TRUSTAP_CLIENT_ID", "cid_test");
  vi.stubEnv("TRUSTAP_WEBHOOK_USER", "hook");
  vi.stubEnv("TRUSTAP_WEBHOOK_PASSWORD", "secret".repeat(8));
  vi.stubEnv("TRUSTAP_SYNC_SECRET", "sync".repeat(10));
  h.webhook.mockResolvedValue(undefined);
  h.batch.mockResolvedValue({ checked: 1 });
});
const req = (body: string, auth = "Basic " + btoa("hook:" + "secret".repeat(8))) =>
  new Request("https://bestottr.com/api/trustap/sandbox/webhook", {
    method: "POST",
    headers: { Authorization: auth },
    body,
  });
it("rejects unauthenticated events before querying orders", async () => {
  expect((await handleTrustapWebhook(req("{}", "wrong"))).status).toBe(401);
  expect(h.webhook).not.toHaveBeenCalled();
});
it("limits body size and rejects malformed JSON", async () => {
  expect((await handleTrustapWebhook(req("x".repeat(32769)))).status).toBe(413);
  expect((await handleTrustapWebhook(req("{"))).status).toBe(400);
  expect(h.webhook).not.toHaveBeenCalled();
});
it("passes only an authenticated hint to server reconciliation", async () => {
  const body = {
    code: "tx.paid",
    target_id: "tx_test123",
    target_preview: { status: "funds_released" },
  };
  expect((await handleTrustapWebhook(req(JSON.stringify(body)))).status).toBe(204);
  expect(h.webhook).toHaveBeenCalledWith(body);
});
it("does not acknowledge a failed durable enqueue", async () => {
  h.webhook.mockRejectedValue(new Error("DB down"));
  expect((await handleTrustapWebhook(req("{}"))).status).toBe(503);
});
it("protects batch reconciliation independently", async () => {
  expect((await handleTrustapSync(req("{}"))).status).toBe(401);
  expect(h.batch).not.toHaveBeenCalled();
  expect((await handleTrustapSync(req("{}", "Bearer " + "sync".repeat(10)))).status).toBe(200);
  expect(h.batch).toHaveBeenCalledOnce();
});
