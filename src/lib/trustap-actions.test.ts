/* eslint-disable @typescript-eslint/no-explicit-any -- Fluent database and server-function test doubles. */
// @vitest-environment node
import { it, expect, vi, beforeEach } from "vitest";
import { trustapOrder, trustapTransaction } from "@/test/trustap-fixture";
const h = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
  get: vi.fn(),
  accept: vi.fn(),
  confirm: vi.fn(),
  owner: vi.fn(),
  updates: [] as any[],
  order: null as any,
  lease: "12345678-1234-4234-8234-123456789019",
}));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: { from: h.from, rpc: h.rpc },
}));
vi.mock("./trustap-provider.server", () => ({
  sandboxConfig: () => ({}),
  trustapSandboxClient: () => ({ get: h.get, acceptPayment: h.accept, confirmDelivery: h.confirm }),
}));
vi.mock("./listing-ownership.server", () => ({ verifyDraftOwnership: h.owner }));
import { runSandboxAction } from "./trustap-sandbox.server";
beforeEach(() => {
  vi.clearAllMocks();
  h.updates = [];
  h.order = {
    ...trustapOrder,
    kind: "experience",
    asset_id: "99",
    target_roblox_id: "123",
    roblox_url: "https://www.roblox.com/games/456",
  };
  h.rpc.mockImplementation(async (name: string) => ({
    data: name.startsWith("claim_") ? h.lease : true,
    error: null,
  }));
  h.from.mockImplementation(() => {
    let fields = "";
    const q: any = {
      select: vi.fn((s: string) => {
        fields = s;
        return q;
      }),
      eq: vi.fn(() => q),
      update: vi.fn((data: any) => {
        h.updates.push(data);
        return q;
      }),
      single: vi.fn(async () => ({
        data: fields.includes("last_sync_attempt_at")
          ? { sync_claim: h.lease, last_sync_attempt_at: new Date().toISOString() }
          : h.order,
        error: null,
      })),
      then: (resolve: any) => Promise.resolve({ data: null, error: null }).then(resolve),
    };
    return q;
  });
  const t = trustapTransaction();
  t.status = "payment_accepted";
  t.events.by_key["paid"] = "2026-10-22T12:00:00Z";
  t.events.by_key["payment_accepted"] = "2026-10-22T12:00:01Z";
  h.get.mockImplementation(async () => structuredClone(t));
  h.owner.mockResolvedValue({ asset_id: "99" });
  h.confirm.mockImplementation(async () => {
    t.status = "delivered";
    t.events.by_key["delivered"] = "2026-10-22T12:00:02Z";
    return t;
  });
});
it("requires a fresh match of the exact buyer-owned asset before confirming delivery", async () => {
  await runSandboxAction(h.order, "ownership");
  expect(h.owner).toHaveBeenCalledWith("experience", h.order.roblox_url, "123");
  expect(h.confirm).toHaveBeenCalledOnce();
  expect(h.get).toHaveBeenCalledTimes(3);
  expect(h.rpc).toHaveBeenLastCalledWith(
    "commit_trustap_sandbox_sync",
    expect.objectContaining({ p_state: "inspection" }),
  );
});
it("never confirms another asset or failed ownership lookup", async () => {
  h.owner.mockResolvedValue({ asset_id: "other" });
  await expect(runSandboxAction(h.order, "ownership")).rejects.toThrow("exact asset");
  expect(h.confirm).not.toHaveBeenCalled();
});
it("checks funding before invoking Roblox", async () => {
  h.get.mockResolvedValue(trustapTransaction());
  await expect(runSandboxAction(h.order, "ownership")).rejects.toThrow("usable payment");
  expect(h.owner).not.toHaveBeenCalled();
  expect(h.confirm).not.toHaveBeenCalled();
});
it("stops if the transaction is refunded during the ownership lookup", async () => {
  const refunded = trustapTransaction();
  refunded.status = "refunded";
  h.get
    .mockResolvedValueOnce({
      ...refunded,
      status: "payment_accepted",
      events: {
        by_key: { paid: "2026-10-22T12:00:00Z", payment_accepted: "2026-10-22T12:00:01Z" },
      },
    })
    .mockResolvedValueOnce(refunded);
  await expect(runSandboxAction(h.order, "ownership")).rejects.toThrow("status changed");
  expect(h.confirm).not.toHaveBeenCalled();
});
it("does not repeat a delivery command after a timeout if GET shows it completed", async () => {
  const delivered = trustapTransaction();
  delivered.status = "delivered";
  delivered.events.by_key = {
    paid: "2026-10-22T12:00:00Z",
    payment_accepted: "2026-10-22T12:00:01Z",
    delivered: "2026-10-22T12:00:02Z",
  };
  h.get.mockResolvedValue(delivered);
  await runSandboxAction(h.order, "ownership");
  expect(h.confirm).not.toHaveBeenCalled();
  expect(h.owner).not.toHaveBeenCalled();
});
it("blocks concurrent actions and never substitutes file receipt for ownership", async () => {
  h.rpc.mockResolvedValueOnce({ data: null, error: null });
  await expect(runSandboxAction(h.order, "ownership")).rejects.toThrow("already running");
  expect(h.get).not.toHaveBeenCalled();
  await expect(runSandboxAction(h.order, "files")).rejects.toThrow("ownership verification");
  expect(h.confirm).not.toHaveBeenCalled();
});
