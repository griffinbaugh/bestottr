import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const id = z.string().regex(/^\d{1,19}$/);
const getJson = async (url: string) => {
  const r = await fetch(url, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(6000) });
  if (!r.ok) throw new Error(`Roblox ${r.status}`);
  return (await r.json()) as unknown;
};

/** Resolve a numeric Roblox user ID to its current public profile. */
export const resolveRobloxUser = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ userId: id }).parse(input))
  .handler(async ({ data }) => {
    try {
      const u = (await getJson(`https://users.roblox.com/v1/users/${data.userId}`)) as { id?: number; name?: string; displayName?: string };
      if (!u.id || String(u.id) !== data.userId || !u.name) return { ok: false as const, reason: "not_found" as const };
      let avatarUrl: string | null = null;
      try {
        const t = (await getJson(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${data.userId}&size=150x150&format=Png`)) as { data?: { imageUrl?: string }[] };
        avatarUrl = t.data?.[0]?.imageUrl ?? null;
      } catch { /* avatar optional */ }
      return { ok: true as const, profile: { userId: data.userId, username: u.name, displayName: u.displayName ?? u.name, avatarUrl } };
    } catch {
      return { ok: false as const, reason: "unavailable" as const };
    }
  });

/** Live Community ownership: the group's `owner.userId` only — roles/ranks are never read. */
export const lookupLiveCommunityOwnership = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ groupId: id }).parse(input))
  .handler(async ({ data }) => {
    const checkedAt = Date.now();
    try {
      const grp = (await getJson(`https://groups.roblox.com/v1/groups/${data.groupId}`)) as { id?: number; owner?: { userId?: number } | null };
      if (String(grp.id) !== data.groupId) return { error: "Community not found", checkedAt };
      return { observation: { placeId: null, universeId: `community:${data.groupId}`, creatorType: "Group" as const, creatorId: data.groupId, groupOwnerId: grp.owner?.userId ? String(grp.owner.userId) : null, source: "roblox:groups v1", checkedAt } };
    } catch (e) {
      return { error: e instanceof Error ? e.message : "lookup failed", checkedAt };
    }
  });

/**
 * Live ownership lookup from Roblox public APIs. Returns a raw observation only;
 * group ownership is the group's `owner.userId` — roles/ranks are never read.
 * Production: call this from a server scheduler, not the browser.
 */
export const lookupLiveOwnership = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ universeId: id, groupId: id.nullable() }).parse(input))
  .handler(async ({ data }) => {
    const checkedAt = Date.now();
    try {
      const g = (await getJson(`https://games.roblox.com/v1/games?universeIds=${data.universeId}`)) as { data?: { id: number; rootPlaceId: number; creator: { id: number; type: string } }[] };
      const game = g.data?.[0];
      if (!game) return { error: "Experience not found", checkedAt };
      const creatorType = game.creator.type === "Group" ? ("Group" as const) : game.creator.type === "User" ? ("User" as const) : null;
      let groupOwnerId: string | null = null;
      if (creatorType === "Group") {
        const grp = (await getJson(`https://groups.roblox.com/v1/groups/${game.creator.id}`)) as { owner?: { userId?: number } | null };
        groupOwnerId = grp.owner?.userId ? String(grp.owner.userId) : null;
      }
      return {
        observation: { placeId: String(game.rootPlaceId), universeId: String(game.id), creatorType, creatorId: String(game.creator.id), groupOwnerId, source: "roblox:games+groups v1", checkedAt },
      };
    } catch (e) {
      return { error: e instanceof Error ? e.message : "lookup failed", checkedAt };
    }
  });
