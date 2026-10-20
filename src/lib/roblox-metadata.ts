import { uniqueGallery, type GalleryImage } from "./gallery";
import type { VerifiedExperience } from "./roblox";

export type RobloxMetadata = { placeId: string; universeId?: string | undefined; name: string; thumbnails: GalleryImage[]; live: boolean; thumbnailsUnavailable: boolean };
/** Metadata never establishes ownership: the existing strict verifier remains the separate gate. */
export async function fetchRobloxMetadata(placeId: string, fallback: VerifiedExperience | undefined, request: typeof fetch = fetch): Promise<RobloxMetadata> {
  const result: RobloxMetadata = { placeId, name: fallback?.title ?? "", thumbnails: [], live: false, thumbnailsUnavailable: true };
  const json = async (url: string) => {
    const res = await request(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error("Roblox metadata unavailable");
    return res.json();
  };
  try {
    const universe = await json(`https://apis.roblox.com/universes/v1/places/${placeId}/universe`);
    if (!universe.universeId || !/^\d+$/.test(String(universe.universeId))) return result;
    result.universeId = String(universe.universeId);
    const [details, thumbs] = await Promise.allSettled([
      json(`https://games.roblox.com/v1/games?universeIds=${result.universeId}`),
      json(`https://thumbnails.roblox.com/v1/games/multiget/thumbnails?universeIds=${result.universeId}&countPerUniverse=10&size=768x432&format=Png&isCircular=false`),
    ]);
    const currentName = details.status === "fulfilled" ? details.value.data?.[0]?.name : undefined;
    const unavailable = typeof currentName === "string" && /\[.*unavailable.*\]/i.test(currentName);
    if (currentName && !unavailable) {
      result.name = currentName;
      result.live = true;
    }
    if (thumbs.status === "fulfilled" && !unavailable) {
      const images = thumbs.value.data?.[0]?.thumbnails ?? [];
      result.thumbnails = uniqueGallery(images.filter((t: { state: string; imageUrl?: string }) => t.state === "Completed" && t.imageUrl?.startsWith("https://")).map((t: { imageUrl: string }, i: number) => ({ id: `roblox-${placeId}-${i}`, url: t.imageUrl, source: "roblox" as const })));
      result.thumbnailsUnavailable = result.thumbnails.length === 0;
    }
  } catch { /* The verified demo name remains deterministic; no unrelated art is imported as Roblox imagery. */ }
  return result;
}