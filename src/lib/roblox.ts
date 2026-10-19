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

type DemoExp = VerifiedExperience & { ownerUserId?: string; groupOwnerId?: string };

/** Deterministic demo registry standing in for the Roblox API. */
export const DEMO_EXPERIENCES: DemoExp[] = [
  {
    placeId: "1830291743",
    title: "Sky Kingdom Builders",
    genre: "Simulator",
    image: "g6",
    creatorType: "User",
    creatorName: "alexr_dev",
    ownerUserId: DEMO_USER_ID,
    monthlyRevenue: 2600,
    monthlyProfit: 2300,
    monthlyVisits: 840000,
    ccu: 380,
  },
  {
    placeId: "2711356802",
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

/** Demo links covering each verification outcome. */
export const DEMO_URLS = DEMO_EXPERIENCES.map((e) => `https://www.roblox.com/games/${e.placeId}/${e.title.replace(/[^a-zA-Z0-9]+/g, "-")}`);

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
