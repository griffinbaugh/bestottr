import { beforeEach, it, expect, vi } from "vitest";
import { review, draft, image, file } from "@/test/listing-review-fixture";
const h = vi.hoisted(() => ({
  account: vi.fn(),
  authorized: vi.fn(),
  moderator: vi.fn(),
  enabled: vi.fn(),
  ownership: vi.fn(),
  copy: vi.fn(),
  rpc: vi.fn(),
  from: vi.fn(),
  signed: vi.fn(),
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
vi.mock("./listing-review.server", () => ({
  authorizedReview: h.authorized,
  requireModerator: h.moderator,
  publicationEnabled: h.enabled,
  freshReviewOwnership: h.ownership,
  snapshotReviewAssets: h.copy,
  publicListing: vi.fn(),
  reviewDetails: vi.fn(),
}));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: h.from,
    rpc: h.rpc,
    storage: { from: () => ({ createSignedUrl: h.signed }) },
  },
}));
import {
  actOnListingReview,
  submitListingReview,
  getReviewDetails,
  getAdminReviews,
  getPublishedListings,
  downloadReviewFile,
} from "./listing-review.functions";
const token = "verified-test-session-token";
const action = (patch: Record<string, unknown> = {}) =>
  actOnListingReview({
    data: { token, id: review.id, version: 2, action: "publish", ...patch } as any,
  });
beforeEach(() => {
  vi.resetAllMocks();
  h.filters = [];
  h.results = [];
  h.account.mockResolvedValue({ id: "moderator" });
  h.authorized.mockResolvedValue(structuredClone(review));
  h.moderator.mockResolvedValue(undefined);
  h.enabled.mockReturnValue(true);
  h.ownership.mockResolvedValue({});
  h.rpc.mockResolvedValue({ data: { ...review, state: "published", version: 3 }, error: null });
  h.from.mockImplementation((table: string) => {
    h.filters.push(["table", table]);
    const result = h.results.shift() ?? { data: [], error: null };
    const b: any = {};
    for (const method of ["select", "eq", "order", "range", "limit", "in", "not"])
      b[method] = (...args: unknown[]) => {
        h.filters.push([method, ...args]);
        return b;
      };
    b.maybeSingle = () => Promise.resolve(result);
    b.then = (resolve: any) => Promise.resolve(result).then(resolve);
    return b;
  });
});
it("authenticates before all private reads and moderation", async () => {
  h.account.mockRejectedValue(new Error("Sign in"));
  for (const call of [
    () => action(),
    () => getReviewDetails({ data: { token, id: review.id } }),
    () => getAdminReviews({ data: { token, state: "in_review", page: 0 } }),
  ])
    await expect(call()).rejects.toThrow("Sign in");
  expect(h.from).not.toHaveBeenCalled();
  expect(h.authorized).not.toHaveBeenCalled();
});
it("requires the database moderator role before approval or queue access", async () => {
  h.moderator.mockRejectedValue(new Error("Moderator access"));
  await expect(action({ action: "approve" })).rejects.toThrow("Moderator access");
  await expect(getAdminReviews({ data: { token, state: "in_review", page: 0 } })).rejects.toThrow(
    "Moderator access",
  );
  expect(h.rpc).not.toHaveBeenCalled();
  expect(h.from).not.toHaveBeenCalled();
});
it("blocks publication when launch control is off, without contacting Roblox", async () => {
  h.enabled.mockReturnValue(false);
  await expect(action()).rejects.toThrow("disabled");
  expect(h.ownership).not.toHaveBeenCalled();
  expect(h.rpc).not.toHaveBeenCalled();
});
it("requires approval of the exact current version", async () => {
  await expect(action({ version: 1 })).rejects.toThrow("changed");
  h.authorized.mockResolvedValue({ ...review, state: "in_review" });
  await expect(action()).rejects.toThrow("Approve");
  expect(h.rpc).not.toHaveBeenCalled();
});
it("never publishes auctions even if publication is enabled", async () => {
  h.authorized.mockResolvedValue({
    ...review,
    snapshot: { ...review.snapshot, format: "auction", auction_ends_at: Date.now() + 100000 },
  });
  await expect(action()).rejects.toThrow("real bidding");
  expect(h.rpc).not.toHaveBeenCalled();
});
it("does not publish after a failed fresh ownership check", async () => {
  h.ownership.mockRejectedValue(new Error("Roblox unavailable"));
  await expect(action()).rejects.toThrow("Roblox unavailable");
  expect(h.rpc).not.toHaveBeenCalled();
});
it("passes the version and server ownership proof into the atomic publication RPC", async () => {
  const proof = {
    asset_id: "200",
    roblox_user_id: "42",
    ownership_checked_at: new Date().toISOString(),
  };
  h.ownership.mockResolvedValue(proof);
  await action();
  expect(h.rpc).toHaveBeenCalledWith(
    "transition_listing_review",
    expect.objectContaining({
      p_actor: "moderator",
      p_version: 2,
      p_publish_allowed: true,
      p_proof: proof,
    }),
  );
});
it("rejects a stale concurrent decision rather than overwriting it", async () => {
  h.rpc.mockResolvedValue({ data: null, error: { message: "version changed" } });
  await expect(action({ action: "approve" })).rejects.toThrow("Refresh");
});
it("requires explicit feedback to reject or unpublish", async () => {
  await expect(action({ action: "reject", note: "no" })).rejects.toThrow("reason");
  expect(h.rpc).not.toHaveBeenCalled();
});
it("only lets the seller withdraw", async () => {
  await expect(action({ action: "withdraw" })).rejects.toThrow("seller");
  expect(h.rpc).not.toHaveBeenCalled();
});
it("does not even query the private catalog while publication is off", async () => {
  h.enabled.mockReturnValue(false);
  expect(await getPublishedListings({ data: { q: "", kind: "all", page: 0 } })).toEqual({
    enabled: false,
    listings: [],
    hasMore: false,
  });
  expect(h.from).not.toHaveBeenCalled();
});
it("authorizes the parent and binds private file links to that review", async () => {
  h.results = [{ data: { path: file.path, filename: file.filename }, error: null }];
  h.signed.mockResolvedValue({ data: { signedUrl: "private-link" }, error: null });
  await downloadReviewFile({ data: { token, reviewId: review.id, fileId: file.id } });
  expect(h.authorized).toHaveBeenCalledWith("moderator", review.id);
  expect(h.filters).toContainEqual(["eq", "review_id", review.id]);
  expect(h.filters).toContainEqual(["eq", "category", "file"]);
  expect(h.signed).toHaveBeenCalledWith(file.path, 60, { download: file.filename });
});
it("does not sign a private file if parent authorization fails", async () => {
  h.authorized.mockRejectedValue(new Error("Denied"));
  await expect(
    downloadReviewFile({ data: { token, reviewId: review.id, fileId: file.id } }),
  ).rejects.toThrow("Denied");
  expect(h.signed).not.toHaveBeenCalled();
  expect(h.from).not.toHaveBeenCalled();
});
it("cannot submit without explicit rights confirmation", async () => {
  await expect(
    submitListingReview({
      data: {
        token,
        draftId: draft.id,
        reviewId: review.id,
        expectedUpdatedAt: draft.updated_at,
        confirmRights: false,
      } as any,
    }),
  ).rejects.toThrow();
  expect(h.account).not.toHaveBeenCalled();
});
it("retries a submission request without copying attachments twice", async () => {
  h.results = [{ data: review, error: null }];
  await submitListingReview({
    data: {
      token,
      draftId: draft.id,
      reviewId: review.id,
      expectedUpdatedAt: draft.updated_at,
      confirmRights: true,
    },
  });
  expect(h.copy).not.toHaveBeenCalled();
  expect(h.rpc).not.toHaveBeenCalled();
  expect(h.filters).toContainEqual(["eq", "seller_id", "moderator"]);
});
it("marks preparation failed when private copies fail and never submits", async () => {
  h.account.mockResolvedValue({ id: "seller" });
  h.results = [
    { data: null, error: null },
    { data: draft, error: null },
    { data: [image, file], error: null },
  ];
  h.rpc.mockResolvedValueOnce({
    data: { created: true, review: { ...review, state: "preparing", version: 0 } },
    error: null,
  });
  h.copy.mockRejectedValue(new Error("Storage failed"));
  await expect(
    submitListingReview({
      data: {
        token,
        draftId: draft.id,
        reviewId: review.id,
        expectedUpdatedAt: draft.updated_at,
        confirmRights: true,
      },
    }),
  ).rejects.toThrow("did not complete");
  expect(h.rpc.mock.calls.map((c) => c[1].p_action)).toEqual([undefined, "fail"]);
});
