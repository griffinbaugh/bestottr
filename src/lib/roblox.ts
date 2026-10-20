// Roblox ownership verification — demo implementation.
// Pure parsing + a deterministic demo registry, structured so a real
// Roblox API/backend layer can replace verifyOwnership without touching the UI.

export type RobloxAccount = { connected: boolean; username?: string | undefined; userId?: string | undefined };

export type CreatorType = "User" | "Group";

export type VerifiedExperience = {
  placeId: string;
  title: string;
  genre: string;
  image: string;
  creatorType: CreatorType;
  creatorName: string;
  monthlyRevenue: number;
  monthlyProfit: number;
  monthlyVisits: number;
  ccu: number;
};

export type VerifyFailure = "invalid_url" | "not_found" | "not_owner" | "not_group_owner";
export type VerifyResult = { ok: true; exp: VerifiedExperience; via?: string } | { ok: false; reason: VerifyFailure };

/** The mock connected account's Roblox user ID. */
export const DEMO_USER_ID = "24816309";
/** The mock connected account's Roblox username. */
export const DEMO_USERNAME = "alexr_dev";

/**
 * Extract a place/experience ID from a pasted Roblox URL.
 * Accepts roblox.com/games/{placeId}/… and create.roblox.com dashboard experience links.
 * Trims whitespace and ignores query strings / hashes. Rejects non-Roblox URLs.
 */
export function parseRobloxPlaceId(input: string): string | null {
  const s = input.trim();
  if (!s) return null;
  let u: URL;
  try {
    u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
  } catch {
    return null;
  }
  const host = u.hostname.toLowerCase();
  if (host !== "roblox.com" && host !== "www.roblox.com" && host !== "create.roblox.com") return null;
  const game = u.pathname.match(/^\/games\/(\d+)(\/|$)/);
  if (game) return game[1] ?? null;
  const dashboard = u.pathname.match(/\/experiences\/(\d+)(\/|$)/);
  if (dashboard) return dashboard[1] ?? null;
  return null;
}

type DemoExp = VerifiedExperience & { ownerUserId?: string; groupOwnerId?: string; universeId: string; groupId?: string };

/** Deterministic demo registry standing in for the Roblox API. */
export const DEMO_EXPERIENCES: DemoExp[] = [
  {
    // Primary demo fixture: guaranteed to verify as directly owned by the demo account.
    placeId: "4920175538",
    universeId: "1702934411",
    title: "Coastline Rescue Roleplay",
    genre: "Roleplay",
    image: "g7",
    creatorType: "User",
    creatorName: DEMO_USERNAME,
    ownerUserId: DEMO_USER_ID,
    monthlyRevenue: 5400,
    monthlyProfit: 4800,
    monthlyVisits: 1650000,
    ccu: 910,
  },
  {
    placeId: "1830291743",
    universeId: "1702934412",
    title: "Sky Kingdom Builders",
    genre: "Simulator",
    image: "g6",
    creatorType: "User",
    creatorName: DEMO_USERNAME,
    ownerUserId: DEMO_USER_ID,
    monthlyRevenue: 2600,
    monthlyProfit: 2300,
    monthlyVisits: 840000,
    ccu: 380,
  },
  {
    placeId: "2711356802",
    universeId: "1702934413",
    groupId: "3310001",
    title: "Rail Rush Tycoon",
    genre: "Tycoon",
    image: "g1",
    creatorType: "Group",
    creatorName: "Bricklane Interactive",
    groupOwnerId: DEMO_USER_ID,
    monthlyRevenue: 4100,
    monthlyProfit: 3700,
    monthlyVisits: 1300000,
    ccu: 690,
  },
  {
    placeId: "5522001198",
    universeId: "1702934414",
    title: "Midnight Courier",
    genre: "Horror",
    image: "g2",
    creatorType: "User",
    creatorName: "nightshift_studios",
    ownerUserId: "77120453",
    monthlyRevenue: 1800,
    monthlyProfit: 1650,
    monthlyVisits: 610000,
    ccu: 240,
  },
  {
    placeId: "6602947184",
    universeId: "1702934415",
    groupId: "3310002",
    title: "Harbor Life Roleplay",
    genre: "Roleplay",
    image: "g4",
    creatorType: "Group",
    creatorName: "Harborworks",
    groupOwnerId: "77120453",
    monthlyRevenue: 3200,
    monthlyProfit: 2800,
    monthlyVisits: 950000,
    ccu: 520,
  },
];

const urlFor = (e: VerifiedExperience) => `https://www.roblox.com/games/${e.placeId}/${e.title.replace(/[^a-zA-Z0-9]+/g, "-")}`;
/** Primary demo link: always verifies as directly owned by DEMO_USER_ID. */
export const DEMO_OWNED_URL = urlFor(DEMO_EXPERIENCES[0]!);
/** Other demo links covering each remaining verification outcome. */
export const DEMO_URLS = DEMO_EXPERIENCES.slice(1).map(urlFor);

/**
 * Strict ownership rule:
 * - User-created experience: creator user ID must exactly match the connected account.
 * - Group-created experience: the connected account must be the group OWNER.
 *   Membership, admin rank, developer role or edit permissions do not qualify.
 */
export function verifyOwnership(input: string, account: RobloxAccount): VerifyResult {
  const placeId = parseRobloxPlaceId(input);
  if (!placeId) return { ok: false, reason: "invalid_url" };
  const exp = DEMO_EXPERIENCES.find((e) => e.placeId === placeId);
  if (!exp) return { ok: false, reason: "not_found" };
  if (!account.connected || !account.userId) return { ok: false, reason: "not_owner" };
  if (exp.creatorType === "User") {
    return exp.ownerUserId === account.userId ? { ok: true, exp } : { ok: false, reason: "not_owner" };
  }
  return exp.groupOwnerId === account.userId ? { ok: true, exp, via: exp.creatorName } : { ok: false, reason: "not_group_owner" };
}

export const VERIFY_ERRORS: Record<VerifyFailure, string> = {
  invalid_url: "That doesn't look like a Roblox experience link. Paste a public game URL such as roblox.com/games/123456789/… — other sites aren't supported.",
  not_found: "We couldn't find an experience at that link. Check the URL and try again.",
  not_owner: "This experience is owned by a different Roblox user. The connected account must own it directly.",
  not_group_owner:
    "This experience is owned by a group, and the connected account is not the group owner. Being a member, admin or developer is not enough — only the group owner can list it.",
};

/* ---------------- Destination account (acquisition transfers) ---------------- */

export type RobloxProfile = { userId: string; username: string; displayName: string; avatarUrl: string | null };
export type ProfileParseFailure = "empty" | "invalid_url" | "not_profile" | "username_only";
export type ProfileParse = { ok: true; userId: string; profileUrl: string } | { ok: false; reason: ProfileParseFailure };

export const profileUrlFor = (userId: string) => `https://www.roblox.com/users/${userId}/profile`;

/**
 * Parse a Roblox profile URL (roblox.com/users/{id}/profile) into a numeric user ID.
 * Rejects other sites, game/group/community links, malformed IDs and bare usernames
 * (usernames can change and are ambiguous; we only accept the immutable numeric ID).
 */
export function parseRobloxProfileUrl(input: string): ProfileParse {
  const s = input.trim();
  if (!s) return { ok: false, reason: "empty" };
  if (/^@?[A-Za-z0-9_]{3,20}$/.test(s) && !/^\d+$/.test(s)) return { ok: false, reason: "username_only" };
  let u: URL;
  try {
    u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
  } catch {
    return { ok: false, reason: "invalid_url" };
  }
  const host = u.hostname.toLowerCase();
  if (!["roblox.com", "www.roblox.com", "m.roblox.com", "web.roblox.com"].includes(host)) return { ok: false, reason: "invalid_url" };
  if (u.protocol !== "https:" && u.protocol !== "http:") return { ok: false, reason: "invalid_url" };
  const m = u.pathname.match(/^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?users\/(\d+)(?:\/profile)?\/?$/i);
  if (!m) return { ok: false, reason: /user\.aspx/i.test(u.pathname) || u.searchParams.has("username") ? "username_only" : "not_profile" };
  const id = m[1]!;
  if (id.length > 19 || /^0/.test(id)) return { ok: false, reason: "invalid_url" };
  return { ok: true, userId: id, profileUrl: profileUrlFor(id) };
}

export const PROFILE_ERRORS: Record<ProfileParseFailure | "not_found", string> = {
  empty: "Paste the destination account's Roblox profile link.",
  invalid_url: "That isn't a valid Roblox profile link. Use roblox.com/users/{userId}/profile.",
  not_profile: "That's a Roblox link, but not a user profile. Game, group and community links can't receive a transfer.",
  username_only: "Usernames can change, so we need the profile link with the numeric user ID (roblox.com/users/{userId}/profile).",
  not_found: "We couldn't find a Roblox user with that ID.",
};

/** Deterministic demo accounts so the transfer flow works without Roblox network access. */
export const DEMO_PROFILES: RobloxProfile[] = [
  { userId: DEMO_USER_ID, username: DEMO_USERNAME, displayName: "Alex Rivera", avatarUrl: null },
  { userId: "55018342", username: "alexr_studio", displayName: "Alex — Studio Alt", avatarUrl: null },
  { userId: "90412277", username: "northpeak_rbx", displayName: "Northpeak", avatarUrl: null },
  { userId: "77120453", username: "nightshift_studios", displayName: "Nightshift Studios", avatarUrl: null },
];
export const DEMO_TARGET_URL = profileUrlFor("55018342");
export const findDemoProfile = (userId: string) => DEMO_PROFILES.find((p) => p.userId === userId) ?? null;
