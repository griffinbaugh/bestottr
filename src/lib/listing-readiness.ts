import type { DraftInput } from "./listing-drafts";
import type { AssetView } from "./listing-assets";
export function listingReadiness(draft: DraftInput, assets: AssetView[], now = Date.now()) {
  const ready = assets.filter((a) => a.status === "ready");
  return [
    {
      label: "Title and description",
      done: draft.title.trim().length >= 3 && draft.description.trim().length > 0,
    },
    { label: "Listing images", done: ready.some((a) => a.category === "image") },
    { label: "Price greater than zero", done: draft.priceCents > 0 },
    ...(draft.format === "auction"
      ? [
          {
            label: "Future auction closing time",
            done: !!draft.auctionEndsAt && draft.auctionEndsAt > now,
          },
        ]
      : []),
    ...(draft.kind === "file"
      ? [{ label: "Deliverable file uploaded", done: ready.some((a) => a.category === "file") }]
      : []),
    { label: "All uploads completed", done: assets.every((a) => a.status === "ready") },
  ];
}
