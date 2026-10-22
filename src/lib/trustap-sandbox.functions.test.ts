/* eslint-disable @typescript-eslint/no-explicit-any -- Fluent database and server-function test doubles. */
import { it, expect, vi, beforeEach } from "vitest";
import { trustapOrder } from "@/test/trustap-fixture";
const h = vi.hoisted(() => ({
  user: vi.fn(),
  order: vi.fn(),
  action: vi.fn(),
  view: vi.fn(),
  sync: vi.fn(),
  admin: vi.fn(),
  from: vi.fn(),
}));
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => ({
    inputValidator: (schema: any) => ({
      handler: (fn: any) => (args: any) => fn({ data: schema.parse(args.data) }),
    }),
  }),
}));
vi.mock("./account.server", () => ({
  verifiedAccount: h.user,
  siteOrigin: () => "https://bestottr.com",
}));
vi.mock("./trustap-sandbox.server", () => ({
  participantOrder: h.order,
  runSandboxAction: h.action,
  orderView: h.view,
  syncSandboxOrder: h.sync,
  sandboxAdmin: h.admin,
  snapshotFiles: vi.fn(),
}));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { from: h.from } }));
import {
  createTrustapSandboxOrder,
  confirmSandboxFiles,
  acceptSandboxPayment,
  downloadSandboxPurchase,
} from "./trustap-sandbox.functions";
const token = "verified-token-for-tests-only";
beforeEach(() => {
  vi.clearAllMocks();
  h.user.mockResolvedValue({ id: trustapOrder.buyer_id });
  h.order.mockResolvedValue(trustapOrder);
  h.action.mockResolvedValue(trustapOrder);
  h.view.mockResolvedValue({});
});
it("rejects unauthenticated operations before privileged order access", async () => {
  h.user.mockRejectedValue(new Error("sign in"));
  await expect(
    confirmSandboxFiles({ data: { token, id: trustapOrder.id, confirm: true } }),
  ).rejects.toThrow("sign in");
  expect(h.order).not.toHaveBeenCalled();
});
it("requires buyer-only explicit file receipt confirmation", async () => {
  await confirmSandboxFiles({ data: { token, id: trustapOrder.id, confirm: true } });
  expect(h.action).toHaveBeenCalledWith(trustapOrder, "files");
  h.action.mockClear();
  h.user.mockResolvedValue({ id: trustapOrder.seller_id });
  await expect(
    confirmSandboxFiles({ data: { token, id: trustapOrder.id, confirm: true } }),
  ).rejects.toThrow("Only the buyer");
  expect(h.action).not.toHaveBeenCalled();
});
it("prevents buyers from accepting the seller's payment", async () => {
  await expect(acceptSandboxPayment({ data: { token, id: trustapOrder.id } })).rejects.toThrow(
    "Only the seller",
  );
  expect(h.action).not.toHaveBeenCalled();
});
it("blocks seller downloads before provider access", async () => {
  h.user.mockResolvedValue({ id: trustapOrder.seller_id });
  await expect(
    downloadSandboxPurchase({
      data: { token, id: trustapOrder.id, fileId: trustapOrder.request_id },
    }),
  ).rejects.toThrow("Only the test buyer");
  expect(h.sync).not.toHaveBeenCalled();
});
it("requires fresh provider funding even if a stale order says funded", async () => {
  h.sync.mockResolvedValue({ ...trustapOrder, state: "refunded" });
  await expect(
    downloadSandboxPurchase({
      data: { token, id: trustapOrder.id, fileId: trustapOrder.request_id },
    }),
  ).rejects.toThrow("Files unlock");
  expect(h.sync).toHaveBeenCalledWith(trustapOrder, true);
});

it("restricts order creation to staff", async () => {
  h.admin.mockResolvedValue(false);
  await expect(
    createTrustapSandboxOrder({
      data: {
        token,
        order: {
          requestId: trustapOrder.request_id,
          draftId: trustapOrder.draft_id!,
          buyerHandle: "buyer",
        },
      },
    }),
  ).rejects.toThrow("administrator");
  expect(h.from).not.toHaveBeenCalled();
});
it("reuses an existing creation request before making another provider transaction", async () => {
  h.user.mockResolvedValue({ id: trustapOrder.seller_id });
  h.admin.mockResolvedValue(true);
  vi.stubEnv("TRUSTAP_SANDBOX_ENABLED", "true");
  vi.stubEnv("TRUSTAP_SANDBOX_API_KEY", "capi_test_fake");
  vi.stubEnv("TRUSTAP_CLIENT_ID", "cid_test");
  const q: any = {
    select: () => q,
    eq: () => q,
    maybeSingle: async () => ({ data: trustapOrder, error: null }),
  };
  h.from.mockReturnValue(q);
  await createTrustapSandboxOrder({
    data: {
      token,
      order: {
        requestId: trustapOrder.request_id,
        draftId: trustapOrder.draft_id!,
        buyerHandle: "buyer",
      },
    },
  });
  expect(h.from).toHaveBeenCalledTimes(1);
  expect(h.from).toHaveBeenCalledWith("trustap_sandbox_orders");
  expect(h.view).toHaveBeenCalledWith(trustapOrder, trustapOrder.seller_id);
});
