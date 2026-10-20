import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { fetchLiveCommunity, fetchLiveExperience, LIVE_TTL_MS } from "./roblox-live";

const id = z.string().regex(/^[1-9]\d{0,18}$/);
// Lightweight per-worker cache; facts are always produced server-side, never from client input.
const cache = new Map<string, { at: number; value: unknown }>();
async function cached<T>(key: string, force: boolean, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && !force && Date.now() - hit.at < LIVE_TTL_MS) return hit.value as T;
  const value = await load();
  cache.set(key, { at: Date.now(), value });
  return value;
}

export const getLiveExperienceFacts = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ placeId: id, force: z.boolean().optional() }).parse(input))
  .handler(({ data }) => cached(`exp:${data.placeId}`, !!data.force, () => fetchLiveExperience(data.placeId)));

export const getLiveCommunityFacts = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ groupId: id, force: z.boolean().optional() }).parse(input))
  .handler(({ data }) => cached(`grp:${data.groupId}`, !!data.force, () => fetchLiveCommunity(data.groupId)));
