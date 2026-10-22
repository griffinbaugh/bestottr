import { it, expect } from "vitest";
import { draft, image, file, review } from "@/test/listing-review-fixture";
import { reviewLocked, reviewReadiness, reviewSummary } from "./listing-review";
it("requires completed images, deliverables and valid sale details before review", () => {
  expect(reviewReadiness(draft, [image, file])).toEqual([]);
  expect(reviewReadiness({ ...draft, description: "", price_cents: 0 }, [])).toHaveLength(4);
  expect(reviewReadiness(draft, [image, { ...file, status: "pending" }])).toContain(
    "Finish or remove incomplete uploads.",
  );
  expect(reviewReadiness({ ...draft, cover_asset_id: "other" }, [image, file])).toContain(
    "Choose a completed listing image as the cover.",
  );
});
it("rechecks absolute auction expiry and reserve", () => {
  expect(
    reviewReadiness(
      { ...draft, format: "auction", auction_ends_at: 100, reserve_cents: 1 },
      [image, file],
      101,
    ),
  ).toEqual([
    "Choose a future auction closing time.",
    "Reserve must be at least the starting bid.",
  ]);
});
it("locks preparing, reviewed and published content, and unlocks returned versions", () => {
  for (const state of ["preparing", "in_review", "approved", "published"] as const)
    expect(reviewLocked(state)).toBe(true);
  for (const state of [undefined, "failed", "withdrawn", "unpublished", "rejected"] as const)
    expect(reviewLocked(state)).toBe(false);
});
it("does not return private storage paths or seller identity in review summaries", () => {
  const summary = reviewSummary(review);
  expect(summary).not.toHaveProperty("snapshot");
  expect(summary).not.toHaveProperty("seller_id");
  expect(JSON.stringify(summary)).not.toContain(file.path);
});
