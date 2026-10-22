/* eslint-disable @typescript-eslint/no-explicit-any -- chained database test double */
import { beforeEach, it, expect, vi } from "vitest";
const h = vi.hoisted(() => ({
  account: vi.fn(),
  from: vi.fn(),
  filters: [] as unknown[][],
  results: [] as any[],
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
import { getNotifications, readNotifications } from "./notifications.functions";
const token = "verified-notification-session-token",
  id = "d3000000-0000-4000-8000-000000000001",
  date = "2026-10-22T12:00:00.123456+00:00";
beforeEach(() => {
  vi.resetAllMocks();
  h.filters = [];
  h.results = [];
  h.account.mockResolvedValue({ id: "actual-user" });
  h.from.mockImplementation(() => {
    const r = h.results.shift() ?? { data: [], error: null, count: 0 },
      b: any = {};
    for (const m of ["select", "eq", "is", "lte", "order", "range", "update"])
      b[m] = (...args: unknown[]) => {
        h.filters.push([m, ...args]);
        return b;
      };
    b.then = (resolve: any) => Promise.resolve(r).then(resolve);
    return b;
  });
});
it("checks a verified account and MFA before any notification read or write", async () => {
  h.account.mockRejectedValue(new Error("Complete two-step verification"));
  await expect(getNotifications({ data: { token, page: 0 } })).rejects.toThrow("two-step");
  await expect(readNotifications({ data: { token, target: { kind: "one", id } } })).rejects.toThrow(
    "two-step",
  );
  expect(h.from).not.toHaveBeenCalled();
});
it("filters both the list and unread count by the server identity", async () => {
  h.results = [
    { data: [{ id, created_at: date }], error: null },
    { count: 73, error: null },
  ];
  const r = await getNotifications({ data: { token, page: 0, user_id: "forged" } as any });
  expect(h.filters.filter((f) => f[0] === "eq")).toEqual([
    ["eq", "user_id", "actual-user"],
    ["eq", "user_id", "actual-user"],
  ]);
  expect(r.unread).toBe(73);
  expect(r.readThrough).toBe(date);
  expect(h.filters).toContainEqual(["is", "read_at", null]);
  expect(h.filters).toContainEqual(["select", "id,title,body,created_at,read_at"]);
});
it("uses a lookahead and disables mark-all cutoffs on older pages", async () => {
  h.results = [
    { data: Array.from({ length: 21 }, () => ({ id, created_at: date })), error: null },
    { count: 2, error: null },
  ];
  const r = await getNotifications({ data: { token, page: 2 } });
  expect(h.filters).toContainEqual(["range", 40, 60]);
  expect(r.items).toHaveLength(20);
  expect(r.hasMore).toBe(true);
  expect(r.readThrough).toBeNull();
});
it("updates only an owned unread notification and leaves first-read timestamps alone", async () => {
  await readNotifications({
    data: { token, target: { kind: "one", id }, user_id: "forged" } as any,
  });
  expect(h.filters).toContainEqual(["eq", "user_id", "actual-user"]);
  expect(h.filters).toContainEqual(["eq", "id", id]);
  expect(h.filters).toContainEqual(["is", "read_at", null]);
  expect(h.filters.find((f) => f[0] === "update")?.[1]).toEqual({ read_at: expect.any(String) });
});
it("bounds mark-all to the fetched cutoff so later arrivals remain unread", async () => {
  await readNotifications({ data: { token, target: { kind: "all", through: date } } });
  expect(h.filters).toContainEqual(["lte", "created_at", date]);
  expect(h.filters).toContainEqual(["eq", "user_id", "actual-user"]);
});
it("does not disguise read failures as an empty notification list", async () => {
  h.results = [
    { error: { message: "DB failed" }, data: null },
    { count: 1, error: null },
  ];
  await expect(getNotifications({ data: { token, page: 0 } })).rejects.toThrow(
    "could not be loaded",
  );
});
it("reports a failed read mutation without claiming success", async () => {
  h.results = [{ error: { message: "DB failed" } }];
  await expect(readNotifications({ data: { token, target: { kind: "one", id } } })).rejects.toThrow(
    "could not be marked",
  );
});
it("rejects malformed IDs and pagination before privileged access", async () => {
  await expect(
    readNotifications({ data: { token, target: { kind: "one", id: "other" } } }),
  ).rejects.toThrow();
  await expect(getNotifications({ data: { token, page: -1 } })).rejects.toThrow();
  expect(h.account).not.toHaveBeenCalled();
});
