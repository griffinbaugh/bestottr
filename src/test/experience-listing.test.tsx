import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, cleanup } from "@testing-library/react";
import { addGalleryImage, coverImage, moveGalleryImage, normalizeGallery, uniqueGallery, type GalleryImage } from "@/lib/gallery";
import { fetchRobloxMetadata } from "@/lib/roblox-metadata";
import { DEMO_EXPERIENCES } from "@/lib/roblox";
import { actions, getState } from "@/lib/store";
import { editExperience } from "@/lib/listing-edit";
import { ExperienceGallery } from "@/components/sb/ExperienceGallery";
import { uploadListingImage } from "@/lib/listing-image-storage";

const images: GalleryImage[] = Array.from({ length: 6 }, (_, n) => ({ id: `image-${n}`, url: `https://tr.rbxcdn.com/${n}.png`, source: "roblox" }));
beforeEach(() => { cleanup(); actions.reset(); });

describe("Experience gallery rules", () => {
  it("imports only the first 5 unique thumbnails", () => {
    expect(uniqueGallery([images[0] as GalleryImage, ...images])).toEqual(images.slice(0, 5));
  });
  it("enforces 5 total including custom and Roblox images", () => {
    const five = addGalleryImage(images.slice(0, 4), { id: "custom", url: "local-image:custom", source: "custom" });
    expect(five).toHaveLength(5);
    expect(() => addGalleryImage(five, images[5] as GalleryImage)).toThrow("at most 5");
  });
  it("supports removing an imported image and adding a custom image", () => {
    const removed = images.slice(0, 3).filter((image) => image.id !== "image-1");
    const result = addGalleryImage(removed, { id: "custom", url: "local-image:custom", source: "custom" });
    expect(result.map((i) => i.id)).toEqual(["image-0", "image-2", "custom"]);
  });
  it("reorder changes cover image", () => {
    const gallery = moveGalleryImage(images.slice(0, 3), 2, 0);
    expect(coverImage({ image: "g1", gallery })).toBe("https://tr.rbxcdn.com/2.png");
  });
  it("legacy image-only listings normalize to one image", () => {
    expect(normalizeGallery({ image: "g8" })).toEqual([{ id: "legacy-g8", url: "g8", source: "custom" }]);
    expect(coverImage({ image: "g8" })).toBe("g8");
  });
  it("all saved images are selectable in the detail gallery", () => {
    render(<ExperienceGallery images={images.slice(0, 5)} title="Coastline" />);
    expect(screen.getAllByRole("button", { name: /Show image/ })).toHaveLength(5);
    fireEvent.click(screen.getByRole("button", { name: "Show image 5" }));
    expect(screen.getByAltText("Coastline — image 5")).toHaveAttribute("src", images[4]?.url);
  });
  it("rejects invalid uploads before saving", async () => {
    await expect(uploadListingImage(new File(["x"], "x.svg", { type: "image/svg+xml" }))).rejects.toThrow("JPG, PNG or WebP");
  });
});

describe("Roblox metadata", () => {
  it("prefills current name and actual unique Roblox thumbnails", async () => {
    const request = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ universeId: 123 })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ name: "Current Roblox name" }] })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ thumbnails: [...images, images[0]].map((i) => ({ state: "Completed", imageUrl: i?.url })) }] })));
    const result = await fetchRobloxMetadata("4920175538", DEMO_EXPERIENCES[0], request);
    expect(result.name).toBe("Current Roblox name");
    expect(result.universeId).toBe("123");
    expect(result.thumbnails.map((i) => i.url)).toEqual(images.slice(0, 5).map((i) => i.url));
    expect(result.thumbnails.every((i) => i.source === "roblox")).toBe(true);
    expect(request.mock.calls[0]?.[0]).toContain("/places/4920175538/universe");
  });
  it("demo fallback retains the verified demo name without importing unrelated stock art", async () => {
    const result = await fetchRobloxMetadata("4920175538", DEMO_EXPERIENCES[0], vi.fn().mockRejectedValue(new Error("Offline")));
    expect(result.name).toBe("Coastline Rescue Roleplay");
    expect(result.thumbnails).toEqual([]);
    expect(result.thumbnailsUnavailable).toBe(true);
  });
  it("uses demo fallback when Roblox returns an unavailable title and placeholder thumbnail", async () => {
    const request = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ universeId: 123 })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ name: "[TITLE UNAVAILABLE]" }] })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ thumbnails: [{ state: "Completed", imageUrl: "https://tr.rbxcdn.com/placeholder.png" }] }] })));
    const result = await fetchRobloxMetadata("4920175538", DEMO_EXPERIENCES[0], request);
    expect(result.name).toBe("Coastline Rescue Roleplay");
    expect(result.thumbnails).toEqual([]);
  });
});

describe("Experience edits", () => {
  it("updates existing listing without duplication and preserves bids and stable URL ID", () => {
    const listing = getState().listings.find((l) => l.id === "castaway");
    if (!listing) throw new Error("Missing fixture");
    const count = getState().listings.length;
    const result = actions.updateExperience(listing.id, { ...listing, title: "Curated Coastline", gallery: images.slice(0, 2) });
    expect(result.ok).toBe(true);
    expect(getState().listings).toHaveLength(count);
    expect(getState().listings.find((l) => l.id === "castaway")).toMatchObject({ id: "castaway", title: "Curated Coastline", bids: listing.bids, status: listing.status, gallery: images.slice(0, 2) });
  });
  it("seller cannot edit another seller's listing", () => {
    const listing = getState().listings.find((l) => l.id === "factory-tycoon");
    if (!listing) throw new Error("Missing fixture");
    expect(actions.updateExperience(listing.id, { ...listing, title: "Unauthorized", gallery: images.slice(0, 1) }).ok).toBe(false);
    expect(getState().listings.find((l) => l.id === listing.id)?.title).toBe(listing.title);
  });
  it("identity, seller, verification and listing ID remain locked even with extra input", () => {
    const listing = getState().listings.find((l) => l.id === "castaway");
    if (!listing) throw new Error("Missing fixture");
    const original = { ...listing, experience: { placeId: "4920175538", name: "Coastline", creatorType: "User" as const, creatorName: "alexr_dev" } };
    const result = editExperience(original, "you", { ...original, id: "changed",  experience: { ...original.experience, placeId: "999" }, seller: { ...listing.seller, handle: "other" }, verified: { ownership: false, revenue: false, traffic: false }, gallery: images.slice(0, 1) } as Parameters<typeof editExperience>[2]);
    expect(result.experience).toEqual(original.experience);
    expect(result.id).toBe("castaway");
    expect(result.seller).toEqual(original.seller);
    expect(result.verified).toEqual(original.verified);
  });
});