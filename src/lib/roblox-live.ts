// Normalized live public Roblox facts. Informational only — never authorizes ownership.
// Pure fetchers take an injectable `request` so tests run without network.

import type { Listing } from "./data";
import { demoCommunity, type CommunityIdentity } from "./community";
import { DEMO_EXPERIENCES } from "./roblox";
import { assetFromListing } from "./roblox-ownership";
import { fetchCommunityPageMedia } from "./community-page-media";

export type LiveCommunityFacts = CommunityIdentity & { unavailable: boolean };

export type LiveExperienceFacts = {
  placeId: string;
  universeId: string | null;
  name: string | null;
  creatorType: "User" | "Group" | null;
  creatorId: string | null;
  creatorName: string | null;
  visits: number | null;
  favorites: number | null;
  playing: number | null;
  maxPlayers: number | null;
  upVotes: number | null;
  downVotes: number | null;
  created: string | null;
  updated: string | null;
  genre: string | null;
  group: LiveCommunityFacts | null;
  fetchedAt: number;
  source: "roblox" | "demo";
  unavailable: boolean;
};

export const likeRatio = (f: Pick<LiveExperienceFacts, "upVotes" | "downVotes">) =>
  f.upVotes !== null && f.downVotes !== null && f.upVotes + f.downVotes > 0 ? f.upVotes / (f.upVotes + f.downVotes) : null;

export const LIVE_TTL_MS = 5 * 60_000;
export const REFRESH_COOLDOWN_MS = 60_000;

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const str = (v: unknown) => (typeof v === "string" && v ? v : null);

type Req = typeof fetch;
const getter = (request: Req) => async (url: string) => {
  const r = await request(url, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(6000) });
  if (!r.ok) throw new Error(`Roblox ${r.status}`);
  return (await r.json()) as Record<string, unknown>;
};

const emptyCommunity = (groupId: string, now: number): LiveCommunityFacts => ({
  groupId, name: "", ownerUserId: "", ownerUsername: "", memberCount: null, iconUrl: null, bannerUrl: null, bannerSource: "none", pageMediaUrls: [], verified: false, fetchedAt: now, source: "roblox", unavailable: true,
});

/**
 * Groups v1 + official group icon thumbnail (authoritative square icon), merged with a
 * best-effort banner extracted from the public Community page (no cookies/auth).
 */
export async function fetchLiveCommunity(groupId: string, request: Req = fetch, now = Date.now()): Promise<LiveCommunityFacts> {
  const demo = demoCommunity(groupId, now);
  if (demo) return { ...demo, bannerSource: demo.bannerUrl ? "demo" : "none", pageMediaUrls: demo.bannerUrl ? [demo.bannerUrl] : [], unavailable: false };
  const json = getter(request);
  try {
    const g = await json(`https://groups.roblox.com/v1/groups/${groupId}`);
    if (String(g["id"]) !== groupId) return emptyCommunity(groupId, now);
    const owner = (g["owner"] ?? null) as { userId?: number; username?: string } | null;
    let iconUrl: string | null = null;
    try {
      const t = await json(`https://thumbnails.roblox.com/v1/groups/icons?groupIds=${groupId}&size=420x420&format=Png&isCircular=false`);
      const d = (t["data"] as { state?: string; imageUrl?: string }[] | undefined)?.[0];
      iconUrl = d?.state === "Completed" && d.imageUrl?.startsWith("https://") ? d.imageUrl : null;
    } catch { /* icon optional */ }
    const media = await fetchCommunityPageMedia(groupId, request, [iconUrl]);
    return {
      groupId,
      name: str(g["name"]) ?? "",
      ownerUserId: owner?.userId ? String(owner.userId) : "",
      ownerUsername: owner?.username ?? "",
      memberCount: num(g["memberCount"]),
      iconUrl,
      bannerUrl: media.bannerUrl,
      bannerSource: media.bannerSource,
      pageMediaUrls: media.pageMediaUrls,
      verified: g["hasVerifiedBadge"] === true,
      description: str(g["description"]) ?? undefined,
      fetchedAt: now,
      source: "roblox",
      unavailable: false,
    };
  } catch {
    return emptyCommunity(groupId, now);
  }
}

function demoExperience(placeId: string, now: number): LiveExperienceFacts | null {
  const e = DEMO_EXPERIENCES.find((x) => x.placeId === placeId);
  if (!e) return null;
  const groupId = e.groupId ?? null;
  return {
    placeId, universeId: e.universeId, name: e.title, creatorType: e.creatorType, creatorId: e.creatorType === "User" ? (e.ownerUserId ?? null) : groupId,
    creatorName: e.creatorName, visits: e.monthlyVisits * 14, favorites: Math.round(e.monthlyVisits / 20), playing: e.ccu, maxPlayers: 30,
    upVotes: Math.round(e.monthlyVisits / 60), downVotes: Math.round(e.monthlyVisits / 600), created: "2023-04-11T00:00:00Z", updated: "2026-10-01T00:00:00Z",
    genre: e.genre, group: groupId ? { ...emptyCommunity(groupId, now), name: e.creatorName, ownerUserId: e.groupOwnerId ?? "", memberCount: 24800, source: "demo", unavailable: false } : null,
    fetchedAt: now, source: "demo", unavailable: false,
  };
}

export async function fetchLiveExperience(placeId: string, request: Req = fetch, now = Date.now()): Promise<LiveExperienceFacts> {
  const demo = demoExperience(placeId, now);
  if (demo) return demo;
  const base: LiveExperienceFacts = {
    placeId, universeId: null, name: null, creatorType: null, creatorId: null, creatorName: null, visits: null, favorites: null, playing: null, maxPlayers: null,
    upVotes: null, downVotes: null, created: null, updated: null, genre: null, group: null, fetchedAt: now, source: "roblox", unavailable: true,
  };
  const json = getter(request);
  try {
    const u = await json(`https://apis.roblox.com/universes/v1/places/${placeId}/universe`);
    const universeId = /^\d+$/.test(String(u["universeId"] ?? "")) ? String(u["universeId"]) : null;
    if (!universeId) return base;
    const [games, votes] = await Promise.allSettled([
      json(`https://games.roblox.com/v1/games?universeIds=${universeId}`),
      json(`https://games.roblox.com/v1/games/votes?universeIds=${universeId}`),
    ]);
    const g = games.status === "fulfilled" ? (games.value["data"] as Record<string, unknown>[] | undefined)?.[0] : undefined;
    const v = votes.status === "fulfilled" ? (votes.value["data"] as Record<string, unknown>[] | undefined)?.[0] : undefined;
    if (!g) return { ...base, universeId };
    const creator = (g["creator"] ?? {}) as { id?: number; name?: string; type?: string };
    const creatorType = creator.type === "Group" ? "Group" : creator.type === "User" ? "User" : null;
    const creatorId = creator.id ? String(creator.id) : null;
    return {
      ...base, universeId, unavailable: false,
      name: str(g["name"]), creatorType, creatorId, creatorName: creator.name ?? null,
      visits: num(g["visits"]), favorites: num(g["favoritedCount"]), playing: num(g["playing"]), maxPlayers: num(g["maxPlayers"]),
      upVotes: num(v?.["upVotes"]), downVotes: num(v?.["downVotes"]), created: str(g["created"]), updated: str(g["updated"]), genre: str(g["genre"]),
      group: creatorType === "Group" && creatorId ? await fetchLiveCommunity(creatorId, request, now) : null,
    };
  } catch {
    return base;
  }
}

/** Deterministic demo facts for seeded listings that have no real Roblox place ID. */
export function demoFactsForListing(l: Listing, now: number): LiveExperienceFacts {
  const a = assetFromListing(l);
  const grp = a.mode !== "user";
  return {
    placeId: a.placeId, universeId: a.universeId, name: l.experience?.name ?? l.title, creatorType: grp ? "Group" : "User", creatorId: grp ? a.groupId : a.originalOwnerId,
    creatorName: l.experience?.creatorName ?? l.seller.name, visits: l.monthlyVisits * Math.max(1, l.ageMonths), favorites: l.favorites, playing: l.ccu, maxPlayers: 40,
    upVotes: Math.round(l.favorites * 0.4), downVotes: Math.round(l.favorites * 0.04), created: new Date(l.createdAt - l.ageMonths * 30 * 86400_000).toISOString(), updated: new Date(l.createdAt).toISOString(),
    genre: l.genre, group: grp && a.groupId ? { ...emptyCommunity(a.groupId, now), name: `${l.seller.name}`, ownerUserId: a.originalOwnerId, ownerUsername: l.seller.handle, memberCount: Math.round(l.favorites * 0.6), source: "demo", unavailable: false } : null,
    fetchedAt: now, source: "demo", unavailable: false,
  };
}
