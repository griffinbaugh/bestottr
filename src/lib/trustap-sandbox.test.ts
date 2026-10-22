import { describe, it, expect, vi } from "vitest";
import { trustapOrder as order, trustapTransaction } from "@/test/trustap-fixture";
import {
  verifyProviderTransaction,
  mayDownload,
  safeCheckoutUrl,
  formatSandboxMoney,
} from "./trustap-sandbox";
import { trustapSandboxClient, sandboxConfig } from "./trustap-provider.server";
describe("Trustap authenticated transaction proof", () => {
  it("does not accept a webhook or checkout redirect as payment proof", () => {
    expect(() =>
      verifyProviderTransaction({ code: "tx.paid", target_id: order.provider_id }, order),
    ).toThrow();
    expect(verifyProviderTransaction(trustapTransaction(), order).state).toBe("awaiting_funding");
  });
  it.each([
    "id",
    "client",
    "description",
    "buyer",
    "seller",
    "guest",
    "amount",
    "fees",
    "extra",
    "currency",
    "shipping",
  ])("rejects mismatched %s", (field) => {
    const t = trustapTransaction();
    if (field === "id") t.id = "tx_other";
    if (field === "client") t.client_id = "other";
    if (field === "description") t.description = "other";
    if (field === "buyer") t.buyer.id = "other";
    if (field === "seller") t.seller.id = "other";
    if (field === "guest") t.buyer.is_guest = true;
    if (field === "amount") t.pricing.amount = 1;
    if (field === "fees") t.pricing.fees.seller_client = 1;
    if (field === "extra") t.pricing.amount_extra = 1;
    if (field === "currency") t.pricing.currency = "eur";
    if (field === "shipping") Object.assign(t, { contains_shipping: true });
    expect(() => verifyProviderTransaction(t, order)).toThrow();
  });
  it("requires paid evidence and does not turn an expired inspection timer into payout", () => {
    const t = trustapTransaction();
    t.status = "paid";
    expect(verifyProviderTransaction(t, order).state).toBe("review");
    t.events.by_key["paid"] = "2026-10-22T12:00:00Z";
    expect(verifyProviderTransaction(t, order).state).toBe("funded");
    t.events.by_key["payment_accepted"] = "2026-10-22T12:00:01Z";
    t.events.by_key["delivered"] = "2026-10-22T12:00:02Z";
    t.status = "complaint_period_ended";
    expect(verifyProviderTransaction(t, order).state).toBe("inspection");
    t.status = "funds_released";
    expect(verifyProviderTransaction(t, order).state).toBe("review");
    t.funds_release.released_to_seller = true;
    expect(verifyProviderTransaction(t, order).state).toBe("completed");
  });
  it.each(["refunded", "cancelled", "complaint_submitted", "review_flagged", "unknown_new_state"])(
    "blocks delivery in %s",
    (status) => {
      const t = trustapTransaction();
      t.status = status;
      t.events.by_key["paid"] = "2026-10-22T12:00:00Z";
      expect(mayDownload(verifyProviderTransaction(t, order).state)).toBe(false);
    },
  );
  it("blocks partial refunds, provider risk and order issues", () => {
    const t = trustapTransaction();
    t.status = "paid";
    t.events.by_key["paid"] = "2026-10-22T12:00:00Z";
    for (const patch of [
      { review: { approved: false } },
      { complaint: { description: "bad" } },
      { order_issue: { description: "missing" } },
      { funds_release: { released_to_seller: false, refunds: [{ id: "1", amount: 1 }] } },
    ])
      expect(verifyProviderTransaction({ ...t, ...patch }, order).state).toBe("review");
  });
});
describe("Trustap sandbox transport", () => {
  it("requires test keys and an explicit flag", () => {
    expect(() =>
      sandboxConfig({
        TRUSTAP_SANDBOX_ENABLED: "true",
        TRUSTAP_SANDBOX_API_KEY: "capi_live",
        TRUSTAP_CLIENT_ID: "cid",
      }),
    ).toThrow();
    expect(() => sandboxConfig({ TRUSTAP_SANDBOX_ENABLED: "false" })).toThrow();
  });
  it("uses integer cents, real fee quotes, a fixed test host and no invented inspection setting", async () => {
    const req = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ buyer: 290, seller: 0, config: 1 }))
      .mockResolvedValueOnce(Response.json(trustapTransaction()));
    const client = trustapSandboxClient(req, { key: "capi_test_fake", clientId: "cid_test" });
    expect((await client.fees(5000)).buyer).toBe(290);
    await client.create(order);
    expect(req.mock.calls[0]![0]).toBe(
      "https://api.test.trustap.com/v2/fees?currency=usd&amount=5000&payment_method=card",
    );
    const options = req.mock.calls[1]![1];
    expect(options.redirect).toBe("manual");
    expect(options.headers.Authorization).toBe("Basic " + btoa("capi_test_fake:"));
    const body = JSON.parse(options.body);
    expect(body.amount).toBe(5000);
    expect(body.fees_buyer).toBe(290);
    expect(body.inspection_period).toBeUndefined();
    expect(options.headers["Trustap-User"]).toBe(order.seller_provider_id);
  });
  it("rejects redirects, live checkout and credential-bearing URLs", async () => {
    for (const u of [
      "https://actions.trustap.com/transactions/tx_test123/pay",
      "https://actions.stage.trustap.com.evil.test/transactions/tx_test123/pay",
      "https://user:pass@actions.stage.trustap.com/transactions/tx_test123/pay",
    ])
      expect(() => safeCheckoutUrl(u, "tx_test123")).toThrow();
    const req = vi.fn().mockResolvedValue(new Response("secret", { status: 302 }));
    await expect(
      trustapSandboxClient(req, { key: "test", clientId: "test" }).get("tx_test123"),
    ).rejects.toThrow("302");
    expect(req).toHaveBeenCalledTimes(1);
  });
  it("sanitizes checkout redirects and sends delivery in the buyer identity", async () => {
    const req = vi.fn().mockResolvedValue(Response.json(trustapTransaction()));
    const c = trustapSandboxClient(req, { key: "test", clientId: "test" });
    const u = c.checkout(
      order.checkout_url + "?redirect_uri=https://evil.test",
      order.provider_id!,
      "https://bestottr.com/account/payments",
    );
    expect(new URL(u).searchParams.get("redirect_uri")).toBe(
      "https://bestottr.com/account/payments",
    );
    await c.confirmDelivery(order);
    expect(req.mock.calls[0]![1].headers["Trustap-User"]).toBe(order.buyer_provider_id);
  });
});

it("formats the complete buyer total without clamping off provider fees", () => {
  expect(formatSandboxMoney(10_000_000_001)).toBe("$100,000,000.01");
  expect(() => formatSandboxMoney(Number.MAX_SAFE_INTEGER + 1)).toThrow();
});
