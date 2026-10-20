import type { Listing } from "./data";

export const MAX_GALLERY_IMAGES = 5;
export type GalleryImage = { id: string; url: string; source: "roblox" | "custom"; storageRef?: string | undefined };
export type ExperienceIdentity = { placeId: string; universeId?: string | undefined; name: string; creatorType: "User" | "Group"; creatorName: string };

export function normalizeGallery(l: Pick<Listing, "image" | "gallery">): GalleryImage[] {
  if (l.gallery) return uniqueGallery(l.gallery);
  return l.image ? [{ id: `legacy-${l.image}`, url: l.image, source: "custom" }] : [];
}
export function uniqueGallery(images: GalleryImage[]): GalleryImage[] {
  const seen = new Set<string>();
  return images.filter((i) => !!i.url && !seen.has(i.url) && !!seen.add(i.url)).slice(0, MAX_GALLERY_IMAGES);
}
export function addGalleryImage(images: GalleryImage[], image: GalleryImage): GalleryImage[] {
  if (images.length >= MAX_GALLERY_IMAGES) throw new Error("A listing can have at most 5 images.");
  return uniqueGallery([...images, image]);
}
export function moveGalleryImage(images: GalleryImage[], from: number, to: number): GalleryImage[] {
  if (from < 0 || to < 0 || from >= images.length || to >= images.length) return images;
  const next = [...images];
  const [image] = next.splice(from, 1);
  if (!image) return images;
  next.splice(to, 0, image);
  return next;
}
export const coverImage = (l: Pick<Listing, "image" | "gallery">) => l.gallery?.[0]?.url ?? l.image;