import { beforeEach, it, expect, vi } from "vitest";
const h = vi.hoisted(() => ({ config: vi.fn(), webhook: vi.fn() }));
vi.mock("./escrow-provider.server", () => ({ sandboxConfig: h.config }));
vi.mock("./escrow-sandbox.server", () => ({ sandboxWebhook: h.webhook }));
import { handleSandboxWebhook } from "./escrow-webhook.server";
beforeEach(() => {
  vi.clearAllMocks();
  h.config.mockReturnValue({});
  h.webhook.mockResolvedValue(undefined);
});
it("returns retryable status when authenticated reconciliation fails", async () => {
  h.webhook.mockRejectedValue(new Error("Provider did not verify funds"));
  const response = await handleSandboxWebhook(
    new Request("https://bestottr.com/api/escrow/sandbox/webhook", {
      method: "POST",
      body: JSON.stringify({
        event_type: "transaction",
        event: "payment_approved",
        transaction_id: 123,
      }),
    }),
  );
  expect(response.status).toBe(503);
});
it("never processes webhooks while sandbox is disabled", async () => {
  h.config.mockImplementation(() => {
    throw new Error("Disabled");
  });
  const response = await handleSandboxWebhook(
    new Request("https://bestottr.com/api/escrow/sandbox/webhook", { method: "POST", body: "{}" }),
  );
  expect(response.status).toBe(503);
  expect(h.webhook).not.toHaveBeenCalled();
});
it("limits payloads and rejects invalid JSON before database work", async () => {
  for (const [body, status] of [
    ["x".repeat(2049), 413],
    ["broken", 400],
  ] as const) {
    const response = await handleSandboxWebhook(
      new Request("https://bestottr.com/api/escrow/sandbox/webhook", { method: "POST", body }),
    );
    expect(response.status).toBe(status);
  }
  expect(h.webhook).not.toHaveBeenCalled();
});
it("acknowledges only after handing the event to server reconciliation", async () => {
  const event = { event_type: "transaction", transaction_id: 123, event: "payment_approved" };
  const response = await handleSandboxWebhook(
    new Request("https://bestottr.com/api/escrow/sandbox/webhook", {
      method: "POST",
      body: JSON.stringify(event),
    }),
  );
  expect(h.webhook).toHaveBeenCalledWith(event);
  expect(response.status).toBe(204);
});
