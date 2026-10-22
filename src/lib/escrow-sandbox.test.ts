import { it, expect, describe, vi, afterEach } from "vitest";
import { escrowOrder, escrowTransaction } from "@/test/escrow-fixture";
import {
  centsFromProvider,
  verifyProviderTransaction,
  mayDownload,
  safeCheckoutUrl,
} from "./escrow-sandbox";
import { escrowSandboxClient, sandboxConfig } from "./escrow-provider.server";
afterEach(() => vi.unstubAllEnvs());
describe("Escrow payment proof", () => {
  it("does not unlock on agreement or an untrusted funding event", () => {
    expect(verifyProviderTransaction(escrowTransaction(), escrowOrder).state).toBe(
      "awaiting_funding",
    );
    expect(() =>
      verifyProviderTransaction({ event: "payment_approved", transaction_id: 123 }, escrowOrder),
    ).toThrow();
    expect(mayDownload("awaiting_funding")).toBe(false);
  });
  it("requires the exact order, parties, goods, amount and inspection terms", () => {
    const changes = [
      (t: any) => (t.id = 456),
      (t: any) => (t.reference = "other"),
      (t: any) => (t.currency = "euro"),
      (t: any) => (t.parties[0].customer = "attacker@example.invalid"),
      (t: any) => (t.items[0].quantity = 2),
      (t: any) => (t.items[0].schedule[0].amount = "0.01"),
      (t: any) => (t.items[0].schedule[0].beneficiary_customer = t.parties[0].customer),
      (t: any) => (t.items[0].inspection_period = 1),
      (t: any) => t.items.push(t.items[0]),
    ];
    for (const change of changes) {
      const t = escrowTransaction();
      change(t);
      expect(() => verifyProviderTransaction(t, escrowOrder)).toThrow();
    }
  });
  it("distinguishes funds secured, inspection, release and refund", () => {
    const t = escrowTransaction();
    const s = t.items[0]!.schedule[0]!.status;
    s.secured = true;
    expect(verifyProviderTransaction(t, escrowOrder).state).toBe("funded");
    t.items[0]!.status.received = true;
    expect(verifyProviderTransaction(t, escrowOrder).state).toBe("inspection");
    s.disbursed_to_beneficiary = true;
    expect(verifyProviderTransaction(t, escrowOrder).state).toBe("completed");
    s.disbursed_to_payer = true;
    expect(verifyProviderTransaction(t, escrowOrder).state).toBe("refunded");
  });
  it.each(["in_dispute", "rejected", "shipped_returned"] as const)(
    "blocks downloads during %s",
    (flag) => {
      const t = escrowTransaction();
      t.items[0]!.schedule[0]!.status.secured = true;
      t.items[0]!.status[flag] = true;
      const result = verifyProviderTransaction(t, escrowOrder);
      expect(result.state).toBe("review");
      expect(mayDownload(result.state)).toBe(false);
    },
  );
  it("blocks pending refunds and cancelled transactions even when funds were secured", () => {
    const t = escrowTransaction();
    t.items[0]!.schedule[0]!.status.secured = true;
    t.is_cancelled = true;
    expect(verifyProviderTransaction(t, escrowOrder).state).toBe("cancelled");
    t.is_cancelled = false;
    t.items[0]!.schedule[0]!.status.refund_created = true;
    expect(verifyProviderTransaction(t, escrowOrder).state).toBe("review");
  });
  it("parses exact decimal cents without accepting exponent or fractional-cent values", () => {
    expect(centsFromProvider("123.45")).toBe(12345);
    expect(centsFromProvider("0.01")).toBe(1);
    for (const v of ["1e4", "0.001", "-1", "NaN", Infinity])
      expect(() => centsFromProvider(v)).toThrow();
  });
});
describe("Sandbox transport", () => {
  it("registers the canonical update hook once and reuses an existing registration", async () => {
    const url = "https://bestottr.com/api/escrow/sandbox/webhook";
    const request = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ webhooks: [] }))
      .mockResolvedValueOnce(Response.json({ id: 42 }))
      .mockResolvedValueOnce(Response.json({ webhooks: [{ id: 42, url }] }));
    const client = escrowSandboxClient(request, { email: "test", key: "test" });
    await client.ensureWebhook(url);
    await client.ensureWebhook(url);
    expect(request).toHaveBeenCalledTimes(3);
    expect(request.mock.calls[1]![1]).toMatchObject({
      method: "POST",
      body: JSON.stringify({ url }),
    });
    expect(request.mock.calls[2]![1]).toMatchObject({ method: "GET" });
  });
  it("requires an explicit sandbox flag and server credentials", () => {
    expect(() =>
      sandboxConfig({
        ESCROW_SANDBOX_ENABLED: "false",
        ESCROW_SANDBOX_EMAIL: "broker@test.escrow.com",
        ESCROW_SANDBOX_API_KEY: "test",
      }),
    ).toThrow("not enabled");
    expect(() => sandboxConfig({ ESCROW_SANDBOX_ENABLED: "true" })).toThrow("credentials");
  });
  it("creates hosted checkout only on the fixed sandbox origin with exact cents and pinned reference", async () => {
    const request = vi.fn(async () =>
      Response.json({ transaction_id: 123, landing_page: escrowOrder.checkout_url }),
    );
    const client = escrowSandboxClient(request, {
      email: "broker@test.escrow.com",
      key: "fake-test-key",
    });
    await client.create(escrowOrder, "https://bestottr.com/account/escrow");
    expect((request.mock.calls as any)[0][0]).toBe(
      "https://api.escrow-sandbox.com/integration/pay/2018-03-31",
    );
    const options = (request.mock.calls as any)[0][1];
    const body = JSON.parse(options.body);
    expect(options.redirect).toBe("manual");
    expect(body.items[0].schedule[0].amount).toBe("123.45");
    expect(body.reference).toBe(escrowOrder.reference);
    expect(body.parties.find((p: any) => p.role === "buyer")).toMatchObject({ lock_email: true });
  });
  it("recovers uncertain checkout creation using a GET, never a second POST", async () => {
    const request = vi.fn(async () =>
      Response.json({ transaction_id: 123, landing_page: escrowOrder.checkout_url }),
    );
    await escrowSandboxClient(request, { email: "broker@test.escrow.com", key: "test" }).recover(
      escrowOrder.reference,
    );
    expect((request.mock.calls as any)[0][1].method).toBe("GET");
  });
  it("rejects live, redirected or arbitrary checkout addresses", async () => {
    for (const address of [
      "https://www.escrow.com/pay?token=x",
      "https://evil.test/pay?token=x",
      "https://www.escrow-sandbox.com.evil.test/pay?token=x",
      "https://user:pass@www.escrow-sandbox.com/pay?token=x",
    ])
      expect(() => safeCheckoutUrl(address)).toThrow();
    const request = vi.fn(
      async () =>
        new Response(null, { status: 302, headers: { Location: "https://api.escrow.com" } }),
    );
    await expect(
      escrowSandboxClient(request, { email: "test", key: "test" }).get("123"),
    ).rejects.toThrow("302");
    expect(request).toHaveBeenCalledTimes(1);
  });
  it("does not return provider response bodies or credential contents in errors", async () => {
    const request = vi.fn(async () => new Response("secret provider details", { status: 401 }));
    await expect(
      escrowSandboxClient(request, { email: "test", key: "secret-key" }).get("123"),
    ).rejects.toThrow("Escrow sandbox request failed (401)");
  });
});
