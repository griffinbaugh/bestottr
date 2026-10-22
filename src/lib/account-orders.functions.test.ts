/* Test doubles model the chained database API. */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, it, expect, vi } from "vitest";
import { trustapOrder } from "@/test/trustap-fixture";
const h = vi.hoisted(() => ({
  account: vi.fn(),
  from: vi.fn(),
  participant: vi.fn(),
  view: vi.fn(),
  admin: vi.fn(),
  filters: [] as unknown[][],
  rows: [] as any[],
  error: null as unknown,
}));
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => ({
    inputValidator: (schema: any) => ({
      handler: (fn: any) => async (args: any) => fn({ data: schema.parse(args.data) }),
    }),
  }),
}));
vi.mock("./account.server", () => ({ verifiedAccount: h.account }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { from: h.from } }));
vi.mock("./trustap-sandbox.server", () => ({
  participantOrder: h.participant,
  orderView: h.view,
  sandboxAdmin: h.admin,
}));
import { getAccountOrders, getAccountOrder } from "./account-orders.functions";
const token = "test-verified-account-session";
beforeEach(() => {
  vi.resetAllMocks();
  h.rows = [];
  h.filters = [];
  h.error = null;
  h.account.mockResolvedValue({ id: "actual-user" });
  h.participant.mockResolvedValue(trustapOrder);
  h.view.mockResolvedValue({ title: trustapOrder.title });
  h.admin.mockResolvedValue(false);
  h.from.mockImplementation((table: string) => {
    h.filters.push(["table", table]);
    const b: any = {};
    for (const m of ["select", "eq", "order"])
      b[m] = (...args: unknown[]) => {
        h.filters.push([m, ...args]);
        return b;
      };
    b.range = (...args: unknown[]) => {
      h.filters.push(["range", ...args]);
      return Promise.resolve({ data: h.rows, error: h.error });
    };
    return b;
  });
});
it("authenticates before privileged list or order access", async () => {
  h.account.mockRejectedValue(new Error("Sign in"));
  await expect(getAccountOrders({ data: { token, side: "buying", page: 0 } })).rejects.toThrow(
    "Sign in",
  );
  await expect(getAccountOrder({ data: { token, id: trustapOrder.id } })).rejects.toThrow(
    "Sign in",
  );
  expect(h.from).not.toHaveBeenCalled();
  expect(h.participant).not.toHaveBeenCalled();
});
it.each([
  ["buying", "buyer_id"],
  ["selling", "seller_id"],
] as const)(
  "filters %s using the verified account, never a browser identity",
  async (side, column) => {
    await getAccountOrders({ data: { token, side, page: 0, userId: "forged" } as any });
    expect(h.filters).toContainEqual(["eq", column, "actual-user"]);
    expect(JSON.stringify(h.filters)).not.toContain("forged");
    const selected = h.filters.find((f) => f[0] === "select")?.[1] as string;
    for (const field of [
      "provider_summary",
      "checkout_url",
      "provider_user_id",
      "sync_claim",
      "path",
      "buyer_id",
      "seller_id",
    ])
      expect(selected).not.toContain(field);
  },
);
it("uses a lookahead to paginate without dropping or duplicating the extra order", async () => {
  h.rows = Array.from({ length: 26 }, (_, i) => ({ ...trustapOrder, id: String(i) }));
  const r = await getAccountOrders({ data: { token, side: "buying", page: 1 } });
  expect(h.filters).toContainEqual(["range", 25, 50]);
  expect(r.orders).toHaveLength(25);
  expect(r.hasMore).toBe(true);
  h.rows = h.rows.slice(0, 25);
  expect((await getAccountOrders({ data: { token, side: "buying", page: 1 } })).hasMore).toBe(
    false,
  );
});
it("reports database failure rather than an empty purchase history", async () => {
  h.error = { message: "DB unavailable" };
  await expect(getAccountOrders({ data: { token, side: "buying", page: 0 } })).rejects.toThrow(
    "could not be loaded",
  );
});
it("checks participation before reading files/history or querying moderator status", async () => {
  h.participant.mockRejectedValue(new Error("Not found"));
  await expect(getAccountOrder({ data: { token, id: trustapOrder.id } })).rejects.toThrow(
    "Not found",
  );
  expect(h.view).not.toHaveBeenCalled();
  expect(h.admin).not.toHaveBeenCalled();
});
it("passes only the verified participant identity to private-order serialization", async () => {
  await getAccountOrder({ data: { token, id: trustapOrder.id } });
  expect(h.participant).toHaveBeenCalledWith("actual-user", trustapOrder.id);
  expect(h.view).toHaveBeenCalledWith(trustapOrder, "actual-user");
});
it("rejects malformed IDs and negative pages before privileged access", async () => {
  await expect(getAccountOrder({ data: { token, id: "demo-slug" } })).rejects.toThrow();
  await expect(getAccountOrders({ data: { token, side: "buying", page: -1 } })).rejects.toThrow();
  expect(h.account).not.toHaveBeenCalled();
});
