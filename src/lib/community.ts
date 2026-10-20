// Roblox Community (Group) listing identity, URL parsing and strict owner verification.
// Demo registry stands in for Roblox; live metadata comes from roblox-live.functions.ts.

import { DEMO_USER_ID, DEMO_USERNAME, type RobloxAccount } from "./roblox";

/** Immutable verified identity + normalized metadata snapshot saved with a Community listing. */
export type CommunityIdentity = {
  groupId: string;
  name: string;
  ownerUserId: string;
  ownerUsername: string;
  memberCount: number | null;
  iconUrl: string | null;
  /** Explicit null when Roblox provides no banner — never substituted with unrelated art. */
  bannerUrl: string | null;
  verified: boolean;
  description?: string | undefined;
  fetchedAt: number;
  source: "roblox" | "demo";
};

const HOSTS = ["roblox.com", "www.roblox.com", "web.roblox.com", "m.roblox.com"];
const validId = (id: string) => id.length <= 19 && !/^0/.test(id);

/**
 * Extract the immutable numeric group/community ID from a Roblox URL.
 * Accepts /communities/{id}/…, /groups/{id}/…, optional locale prefix, and legacy
 * /groups/group.aspx?gid={id}. Rejects other sites, user/game links and malformed IDs.
 */
export function parseRobloxCommunityId(input: string): string | null {
  const s = input.trim();
  if (!s) return null;
  let u: URL;
  try {
    u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
  } catch {
    return null;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  if (!HOSTS.includes(u.hostname.toLowerCase())) return null;
  const m = u.pathname.match(/^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?(?:communities|groups)\/(\d+)(?:\/[^/]*)?\/?$/i);
  if (m?.[1]) return validId(m[1]) ? m[1] : null;
  if (/^\/groups\/group\.aspx$/i.test(u.pathname)) {
    const gid = u.searchParams.get("gid");
    return gid && /^\d+$/.test(gid) && validId(gid) ? gid : null;
  }
  return null;
}

export const communityUrl = (groupId: string) => `https://www.roblox.com/communities/${groupId}`;
export const gameUrl = (placeId: string) => `https://www.roblox.com/games/${placeId}`;

type DemoCommunity = Omit<CommunityIdentity, "fetchedAt" | "source"> & { admins: string[]; members: string[] };

/** Deterministic demo registry. Owner is the single source of truth; admins/members never qualify. */
export const DEMO_COMMUNITIES: DemoCommunity[] = [
  { groupId: "3310003", name: "Northwind Collective", ownerUserId: DEMO_USER_ID, ownerUsername: DEMO_USERNAME, memberCount: 12840, iconUrl: "c3", bannerUrl: null, verified: false, description: "Builders and scripters collective.", admins: ["90412277"], members: [] },
  { groupId: "3310006", name: "Forgeline Studios", ownerUserId: DEMO_USER_ID, ownerUsername: DEMO_USERNAME, memberCount: 86500, iconUrl: "c1", bannerUrl: "cb1", verified: true, description: "Studio community with an active fan base.", admins: [], members: [] },
  { groupId: "3310002", name: "Harborworks", ownerUserId: "77120453", ownerUsername: "nightshift_studios", memberCount: 21400, iconUrl: "c2", bannerUrl: null, verified: false, admins: [DEMO_USER_ID], members: [] },
  { groupId: "3310007", name: "Obby Makers Hub", ownerUserId: "90412277", ownerUsername: "northpeak_rbx", memberCount: 5300, iconUrl: "c2", bannerUrl: null, verified: false, admins: [], members: [DEMO_USER_ID] },
];

export const DEMO_COMMUNITY_URLS = {
  owned: communityUrl("3310006") + "/Forgeline-Studios",
  ownedNoBanner: "https://www.roblox.com/groups/3310003/Northwind-Collective",
  adminOnly: communityUrl("3310002"),
  memberOnly: communityUrl("3310007"),
};

export const demoCommunity = (groupId: string, now: number): CommunityIdentity | null => {
  const c = DEMO_COMMUNITIES.find((x) => x.groupId === groupId);
  if (!c) return null;
  const { admins: _a, members: _m, ...rest } = c;
  return { ...rest, fetchedAt: now, source: "demo" };
};

export type CommunityVerifyFailure = "invalid_url" | "not_found" | "not_owner";
export type CommunityVerifyResult = { ok: true; community: CommunityIdentity } | { ok: false; reason: CommunityVerifyFailure };

/** Exact-owner rule: connected Roblox user ID must equal the community owner's user ID. */
export function checkCommunityOwner(community: Pick<CommunityIdentity, "ownerUserId"> | null, account: RobloxAccount): boolean {
  return !!community && !!account.connected && !!account.userId && community.ownerUserId === account.userId;
}

export function verifyCommunityOwnership(input: string, account: RobloxAccount, now = Date.now()): CommunityVerifyResult {
  const groupId = parseRobloxCommunityId(input);
  if (!groupId) return { ok: false, reason: "invalid_url" };
  const c = demoCommunity(groupId, now);
  if (!c) return { ok: false, reason: "not_found" };
  return checkCommunityOwner(c, account) ? { ok: true, community: c } : { ok: false, reason: "not_owner" };
}

export const COMMUNITY_ERRORS: Record<CommunityVerifyFailure, string> = {
  invalid_url: "That isn't a Roblox Community link. Paste a link like roblox.com/communities/123456/… — user, game and other sites aren't supported.",
  not_found: "We couldn't find a Community with that ID.",
  not_owner: "The connected Roblox account is not the owner of this Community. Members, admins and high ranks can't list it — only the owner.",
};
