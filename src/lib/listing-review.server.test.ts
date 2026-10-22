import { beforeEach, afterEach, it, expect, vi } from "vitest";
import { review, image, file } from "@/test/listing-review-fixture";
const h = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
  storage: vi.fn(),
  verify: vi.fn(),
  results: [] as any[],
  filters: [] as unknown[][],
}));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: { from: h.from, rpc: h.rpc, storage: { from: h.storage } },
}));
vi.mock("./listing-ownership.server", () => ({ verifyDraftOwnership: h.verify }));
import {
  publicImage,
  publicReview,
  publicListing,
  authorizedReview,
  freshReviewOwnership,
  editableDraft,
} from "./listing-review.server";
beforeEach(() => {
  vi.resetAllMocks();
  h.results = [];
  h.filters = [];
  vi.stubEnv("LISTING_PUBLICATION_ENABLED", "true");
  h.from.mockImplementation((table: string) => {
    h.filters.push(["table", table]);
    const result = h.results.shift() ?? { data: [], error: null };
    const b: any = {};
    for (const method of ["select", "eq", "in", "limit", "order"])
      b[method] = (...args: unknown[]) => {
        h.filters.push([method, ...args]);
        return b;
      };
    b.maybeSingle = () => Promise.resolve(result);
    b.then = (resolve: any) => Promise.resolve(result).then(resolve);
    return b;
  });
});
afterEach(() => vi.unstubAllEnvs());
it("hides images and details before launch, without private database access", async () => {
  vi.stubEnv("LISTING_PUBLICATION_ENABLED", "false");
  expect((await publicImage(image.id)).status).toBe(404);
  expect(await publicReview(review.id)).toBeNull();
  expect(h.from).not.toHaveBeenCalled();
});
it("never serves a deliverable through the public image endpoint", async () => {
  h.results = [{ data: null, error: null }];
  expect((await publicImage(file.id)).status).toBe(404);
  expect(h.filters).toContainEqual(["eq", "category", "image"]);
  expect(h.storage).not.toHaveBeenCalled();
});
it("requires a currently published parent before serving an image", async () => {
  h.results = [
    { data: { ...image, review_id: review.id, ready: true }, error: null },
    { data: null, error: null },
  ];
  expect((await publicImage(image.id)).status).toBe(404);
  expect(h.filters).toContainEqual(["eq", "state", "published"]);
  expect(h.storage).not.toHaveBeenCalled();
});
it("serves approved snapshot images with no cache or sniffing", async () => {
  h.results = [
    { data: { ...image, review_id: review.id, ready: true }, error: null },
    { data: { ...review, state: "published" }, error: null },
  ];
  h.storage.mockReturnValue({
    download: async () => ({ data: new Blob(["image bytes"]), error: null }),
  });
  const r = await publicImage(image.id);
  expect(r.status).toBe(200);
  expect(r.headers.get("cache-control")).toContain("no-store");
  expect(r.headers.get("x-content-type-options")).toBe("nosniff");
});
it("allowlists public metadata and never returns files, identity IDs or moderation feedback", async () => {
  h.results = [
    {
      data: [
        { ...image, source_asset_id: image.id },
        { ...file, source_asset_id: file.id },
      ],
      error: null,
    },
    { data: { handle: "seller" }, error: null },
  ];
  const r = await publicListing({ ...review, state: "published", published_at: review.created_at });
  expect(r.file_count).toBe(1);
  expect(r.images[0]?.url).toBe("/api/listing-media/" + image.id);
  for (const value of [file.path, file.filename, "Internal feedback", "moderator"])
    expect(JSON.stringify(r)).not.toContain(value);
  expect(r).not.toHaveProperty("seller_id");
  expect(r).not.toHaveProperty("snapshot");
});
it("denies unrelated review access even if a privileged lookup finds it", async () => {
  h.results = [{ data: review, error: null }];
  h.rpc.mockResolvedValue({ data: false, error: null });
  await expect(authorizedReview("stranger", review.id)).rejects.toThrow("Moderator access");
});
it("fails closed when review locks cannot be checked", async () => {
  h.results = [{ data: null, error: { message: "DB failed" } }];
  await expect(editableDraft("seller", review.draft_id!)).rejects.toThrow("could not be checked");
});
it("requires current linked Roblox identity and a new exact-asset lookup", async () => {
  const d = {
    ...review.snapshot,
    kind: "experience" as const,
    asset_id: "200",
    place_id: "100",
    roblox_user_id: "42",
  };
  h.results = [{ data: { roblox_user_id: "42" }, error: null }];
  h.verify.mockResolvedValue({ asset_id: "200" });
  await freshReviewOwnership(d);
  expect(h.verify).toHaveBeenCalledWith("experience", "https://www.roblox.com/games/100", "42");
  h.results = [{ data: { roblox_user_id: "99" }, error: null }];
  await expect(freshReviewOwnership(d)).rejects.toThrow("identity changed");
  expect(h.verify).toHaveBeenCalledTimes(1);
});
