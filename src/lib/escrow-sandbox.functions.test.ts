import { beforeEach, expect, it, vi } from "vitest";
import { escrowOrder } from "@/test/escrow-fixture";
const h = vi.hoisted(() => ({
  user: vi.fn(),
  admin: vi.fn(),
  participant: vi.fn(),
  sync: vi.fn(),
  view: vi.fn(),
  from: vi.fn(),
  signed: vi.fn(),
  config: vi.fn(),
  create: vi.fn(),
  recover: vi.fn(),
  snapshot: vi.fn(),
  filters: [] as unknown[][],
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
vi.mock("./escrow-sandbox.server", () => ({
  sandboxAdmin: h.admin,
  participantOrder: h.participant,
  syncSandboxOrder: h.sync,
  orderView: h.view,
  snapshotFiles: h.snapshot,
}));
vi.mock("./escrow-provider.server", () => ({
  sandboxConfig: h.config,
  escrowSandboxClient: () => ({ create: h.create, recover: h.recover }),
}));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: { from: h.from, storage: { from: () => ({ createSignedUrl: h.signed }) } },
}));
import {
  createEscrowSandboxOrder,
  downloadSandboxPurchase,
  reconcileEscrowSandbox,
} from "./escrow-sandbox.functions";
const token = "sandbox-test-not-a-real-token";
const id = escrowOrder.id;
const form = {
  requestId: escrowOrder.request_id,
  draftId: "cc000000-0000-4000-8000-000000000003",
  buyerHandle: "buyer",
  buyerEmail: escrowOrder.buyer_email,
  sellerEmail: escrowOrder.seller_email,
  inspectionDays: 3,
};
beforeEach(() => {
  vi.clearAllMocks();
  h.filters = [];
  h.user.mockResolvedValue({ id: "buyer" });
  h.admin.mockResolvedValue(true);
  h.participant.mockResolvedValue({ ...escrowOrder });
  h.sync.mockResolvedValue({ ...escrowOrder, state: "funded" });
  h.view.mockImplementation(async (o) => o);
  h.signed.mockResolvedValue({
    data: { signedUrl: "https://storage.example/signed" },
    error: null,
  });
  h.from.mockImplementation(() => {
    const b: any = {
      select: () => b,
      eq: (...v: any[]) => {
        h.filters.push(v);
        return b;
      },
      maybeSingle: async () => ({
        data: { id: "file", order_id: id, path: "order/file", filename: "model.zip", ready: true },
        error: null,
      }),
    };
    return b;
  });
});
it("denies unauthenticated sandbox order creation before database or provider use", async () => {
  h.user.mockRejectedValue(new Error("Sign in first"));
  await expect(createEscrowSandboxOrder({ data: { token, order: form } })).rejects.toThrow(
    "Sign in",
  );
  expect(h.from).not.toHaveBeenCalled();
  expect(h.create).not.toHaveBeenCalled();
});
it("requires a server-verified administrator for sandbox order creation", async () => {
  h.admin.mockResolvedValue(false);
  await expect(createEscrowSandboxOrder({ data: { token, order: form } })).rejects.toThrow(
    "administrator",
  );
  expect(h.from).not.toHaveBeenCalled();
  expect(h.create).not.toHaveBeenCalled();
});
it("reuses an existing request instead of creating a second provider transaction", async () => {
  h.user.mockResolvedValue({ id: "seller" });
  h.from.mockImplementation(() => {
    const b: any = {
      select: () => b,
      eq: () => b,
      maybeSingle: async () => ({ data: escrowOrder, error: null }),
    };
    return b;
  });
  await createEscrowSandboxOrder({ data: { token, order: form } });
  expect(h.create).not.toHaveBeenCalled();
  expect(h.snapshot).not.toHaveBeenCalled();
});
it("rejects the seller before payment lookup or file signing", async () => {
  h.user.mockResolvedValue({ id: "seller" });
  await expect(
    downloadSandboxPurchase({ data: { token, id, fileId: form.draftId } }),
  ).rejects.toThrow("test buyer");
  expect(h.sync).not.toHaveBeenCalled();
  expect(h.signed).not.toHaveBeenCalled();
});
it("does not sign downloads after a refund, review, cancellation or provider outage", async () => {
  for (const state of ["refunded", "cancelled", "review", "awaiting_funding"]) {
    h.sync.mockResolvedValue({ ...escrowOrder, state });
    await expect(
      downloadSandboxPurchase({ data: { token, id, fileId: form.draftId } }),
    ).rejects.toThrow("secured test funds");
  }
  h.sync.mockRejectedValue(new Error("Provider unavailable"));
  await expect(
    downloadSandboxPurchase({ data: { token, id, fileId: form.draftId } }),
  ).rejects.toThrow("Provider unavailable");
  expect(h.signed).not.toHaveBeenCalled();
});
it("downloads only the immutable file of the correct order after a forced fresh check", async () => {
  await downloadSandboxPurchase({ data: { token, id, fileId: form.draftId } });
  expect(h.sync).toHaveBeenCalledWith(escrowOrder, true);
  expect(h.filters).toContainEqual(["order_id", id]);
  expect(h.filters).toContainEqual(["ready", true]);
  expect(h.signed).toHaveBeenCalledWith("order/file", 60, { download: "model.zip" });
});
it("does not retry creation when reconciling an unknown provider outcome", async () => {
  h.participant.mockResolvedValue({
    ...escrowOrder,
    provider_id: null,
    state: "creation_uncertain",
  });
  h.recover.mockRejectedValue(new Error("Not yet found"));
  await expect(reconcileEscrowSandbox({ data: { token, id } })).rejects.toThrow("Not yet found");
  expect(h.recover).toHaveBeenCalledWith(escrowOrder.reference);
  expect(h.create).not.toHaveBeenCalled();
});
