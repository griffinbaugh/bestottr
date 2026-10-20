import { describe, expect, it, vi, beforeEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { createMemoryHistory, createRootRoute, createRouter, RouterProvider } from "@tanstack/react-router";
import { QueryClient } from "@tanstack/react-query";

vi.mock("@tanstack/react-start", async (orig) => ({ ...(await orig<typeof import("@tanstack/react-start")>()), useServerFn: (f: unknown) => f }));
vi.mock("@/lib/roblox-live.functions", async () => {
  const live = await import("@/lib/roblox-live");
  return {
    getLiveCommunityFacts: ({ data }: { data: { groupId: string } }) => live.fetchLiveCommunity(data.groupId, (() => Promise.reject(new Error("offline"))) as unknown as typeof fetch),
    getLiveExperienceFacts: ({ data }: { data: { placeId: string } }) => live.fetchLiveExperience(data.placeId, (() => Promise.reject(new Error("offline"))) as unknown as typeof fetch),
  };
});

import { COMMUNITY_ERRORS, checkCommunityOwner, communityUrl, demoCommunity, parseRobloxCommunityId, verifyCommunityOwnership } from "@/lib/community";
import { DEMO_USER_ID, DEMO_USERNAME, profileUrlFor } from "@/lib/roblox";
import { CommunityBanner } from "@/components/sb/CommunityHero";
import { ExperienceFactsView, LiveCommunityData } from "@/components/sb/LiveRobloxData";
import { ListingCard } from "@/components/sb/ListingCard";
import { fetchLiveCommunity, fetchLiveExperience, likeRatio } from "@/lib/roblox-live";
import { actions, getState } from "@/lib/store";
import { applyCheck, chooseTarget, confirmTarget, createTransfer, fundTransfer, type Observation } from "@/lib/transfer";
import { assetFromListing } from "@/lib/roblox-ownership";
import { SELLER_PROVIDED_NOTE, sellerRevenue, validateReserve } from "@/lib/financials";
import { editCommunity } from "@/lib/listing-edit";
import { reviewsFor } from "@/lib/data";
import { routeTree } from "@/routeTree.gen";

const account = { connected: true, userId: DEMO_USER_ID, username: DEMO_USERNAME };
beforeEach(() => { cleanup(); actions.reset(); });

function withRouter(node: React.ReactNode) {
  const rootRoute = createRootRoute({ component: () => <>{node}</> });
  const router = createRouter({ routeTree: rootRoute, history: createMemoryHistory({ initialEntries: ["/"] }) });
  return render(<RouterProvider router={router} />);
}

describe("Community URL parsing", () => {
  it("accepts modern and legacy Roblox community/group URLs", () => {
    expect(parseRobloxCommunityId("https://www.roblox.com/communities/3310006/Forgeline-Studios")).toBe("3310006");
    expect(parseRobloxCommunityId("roblox.com/groups/3310003/Northwind#!/about")).toBe("3310003");
    expect(parseRobloxCommunityId("https://www.roblox.com/en-us/communities/42")).toBe("42");
    expect(parseRobloxCommunityId("https://www.roblox.com/groups/group.aspx?gid=77")).toBe("77");
  });
  it("rejects user, game, non-Roblox, malformed and username-only input", () => {
    for (const bad of ["https://www.roblox.com/users/24816309/profile", "https://www.roblox.com/games/4920175538/x", "https://evil.com/communities/3310006", "https://www.roblox.com/communities/abc", "https://www.roblox.com/communities/0123", "Forgeline", "https://roblox.com.evil.io/groups/1"]) {
      expect(parseRobloxCommunityId(bad)).toBeNull();
    }
  });
});

describe("Community ownership verification", () => {
  it("exact owner passes; admin or member fails", () => {
    expect(verifyCommunityOwnership(communityUrl("3310006"), account).ok).toBe(true);
    expect(verifyCommunityOwnership(communityUrl("3310002"), account)).toEqual({ ok: false, reason: "not_owner" });
    expect(verifyCommunityOwnership(communityUrl("3310007"), account)).toEqual({ ok: false, reason: "not_owner" });
    expect(verifyCommunityOwnership("https://www.roblox.com/games/1", account)).toEqual({ ok: false, reason: "invalid_url" });
    expect(checkCommunityOwner({ ownerUserId: DEMO_USER_ID }, { connected: false })).toBe(false);
    expect(COMMUNITY_ERRORS.not_owner).toMatch(/admins/);
  });
  it("metadata autofills name, members, icon, banner and verified status", () => {
    const r = verifyCommunityOwnership(communityUrl("3310006"), account);
    if (!r.ok) throw new Error("expected pass");
    expect(r.community).toMatchObject({ name: "Forgeline Studios", memberCount: 86500, iconUrl: "c1", bannerUrl: "cb1", verified: true, ownerUserId: DEMO_USER_ID });
    expect(demoCommunity("3310003", 0)?.bannerUrl).toBeNull();
  });
  it("live community fetch normalizes Roblox data with no substituted banner", async () => {
    const req = (async (url: string) => ({ ok: true, json: async () => (url.includes("thumbnails") ? { data: [{ state: "Completed", imageUrl: "https://tr.rbxcdn.com/icon.png" }] } : { id: 999, name: "Live Co", owner: { userId: 5, username: "own" }, memberCount: 1200, hasVerifiedBadge: true }) })) as unknown as typeof fetch;
    const f = await fetchLiveCommunity("999", req, 1);
    expect(f).toMatchObject({ name: "Live Co", ownerUserId: "5", memberCount: 1200, iconUrl: "https://tr.rbxcdn.com/icon.png", bannerUrl: null, verified: true, unavailable: false });
  });
});

describe("Community card + detail", () => {
  it("missing banner renders a neutral blank with the icon overlay", () => {
    render(<CommunityBanner c={{ name: "N", iconUrl: "c3", bannerUrl: null, verified: false }} />);
    expect(screen.getByTestId("community-banner-blank")).toBeInTheDocument();
    expect(screen.queryByTestId("community-banner-image")).toBeNull();
    expect(screen.getByTestId("community-icon")).toBeInTheDocument();
  });
  it("card shows banner + centered icon, verified badge only when verified, and seller profile link", async () => {
    const verified = getState().listings.find((l) => l.id === "community-forgeline")!;
    withRouter(<ListingCard listing={verified} />);
    expect(await screen.findByTestId("community-card")).toBeInTheDocument();
    expect(screen.getByTestId("community-banner-image")).toBeInTheDocument();
    expect(screen.getByTestId("community-icon")).toBeInTheDocument();
    expect(screen.getByTestId("roblox-verified")).toBeInTheDocument();
    expect(screen.getByTestId("seller-link")).toHaveAttribute("href", "/user/kenzo_labs");
    cleanup();
    withRouter(<ListingCard listing={getState().listings.find((l) => l.id === "community-stairway")!} />);
    expect(await screen.findByTestId("community-card")).toBeInTheDocument();
    expect(screen.queryByTestId("roblox-verified")).toBeNull();
    expect(screen.getByText(/mo revenue\*/)).toBeInTheDocument();
  });
  it("detail live section has a clickable external Roblox Community link and survives an outage", async () => {
    render(<LiveCommunityData l={getState().listings.find((l) => l.id === "community-forgeline")!} />);
    const link = await screen.findByRole("link", { name: /View on Roblox/ });
    expect(link).toHaveAttribute("href", "https://www.roblox.com/communities/48120931");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(await screen.findByText(/unavailable right now/)).toBeInTheDocument();
    expect(screen.getAllByText("Forgeline Studios").length).toBeGreaterThan(0);
  });
});

describe("Community acquisition", () => {
  const T0 = 1_000_000;
  const funded = () => {
    const l = getState().listings.find((x) => x.id === "community-forgeline")!;
    let t = createTransfer("d1", assetFromListing(l), 1000, T0);
    t = chooseTarget(t, { userId: "55018342", username: "alt", displayName: "Alt", profileUrl: profileUrlFor("55018342"), avatarUrl: null, source: "profile_url" }, T0).t;
    return fundTransfer(confirmTarget(t, T0).t, T0).t;
  };
  const obs = (o: Partial<Observation>) => ({ observation: <Observation>{ placeId: null, universeId: "community:48120931", creatorType: "Group", creatorId: "48120931", groupOwnerId: "55018342", source: "test", checkedAt: T0 + 1, ...o } });
  it("standalone Community completes only when the target owns the exact Community ID", () => {
    expect(funded().asset).toMatchObject({ mode: "community", groupId: "48120931", placeId: "" });
    expect(applyCheck(funded(), obs({}), T0 + 2).t.state).toBe("completed");
  });
  it("wrong Community, or target merely admin (owner unchanged), does not complete", () => {
    expect(applyCheck(funded(), obs({ creatorId: "999" }), T0 + 2).t.payment.status).toBe("held");
    expect(applyCheck(funded(), obs({ groupOwnerId: "90412277" }), T0 + 2).t.payment.status).toBe("held");
  });
  it("buying a Community listing opens an automated acquisition deal", () => {
    const id = actions.buyNow("community-stairway");
    expect(getState().deals.find((d) => d.id === id)?.acquisition?.asset.mode).toBe("community");
  });
  it("editing keeps the Community identity locked and rejects other sellers", () => {
    const mine = getState().listings.find((x) => x.id === "community-northwind")!;
    const changes = { title: "New title", tagline: "", description: "", tags: [], format: "auction" as const, startingBid: 0, reserve: undefined, buyNow: undefined, endsAt: mine.endsAt, monthlyRevenue: 0, monthlyProfit: 0, financialsProvided: false, assets: mine.assets, risks: [] };
    const edited = editCommunity(mine, "you", { ...changes, community: { ...mine.community!, groupId: "1" } } as never);
    expect(edited.community?.groupId).toBe("3310003");
    expect(edited.title).toBe("New title");
    expect(() => editCommunity(getState().listings.find((x) => x.id === "community-forgeline")!, "you", changes)).toThrow(/own Community/);
    expect(actions.updateCommunity("community-northwind", changes).ok).toBe(true);
    expect(getState().listings.filter((x) => x.kind === "community")).toHaveLength(3);
  });
});

describe("Experience live data", () => {
  it("normalizes visits, favorites, playing and like ratio from Roblox", async () => {
    const req = (async (url: string) => ({ ok: true, json: async () => (url.includes("/universe") ? { universeId: 77 } : url.includes("votes") ? { data: [{ upVotes: 900, downVotes: 100 }] } : { data: [{ name: "Live Game", visits: 5000, favoritedCount: 300, playing: 42, maxPlayers: 20, created: "2024-01-01T00:00:00Z", updated: "2026-01-01T00:00:00Z", genre: "RPG", creator: { id: 8, name: "Me", type: "User" } }] }) })) as unknown as typeof fetch;
    const f = await fetchLiveExperience("123", req, 1);
    expect(f).toMatchObject({ universeId: "77", visits: 5000, favorites: 300, playing: 42, creatorType: "User", unavailable: false });
    expect(likeRatio(f)).toBe(0.9);
    render(<ExperienceFactsView f={f} />);
    expect(screen.getByText("90%")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
  });
  it("API outage marks facts unavailable instead of throwing", async () => {
    const f = await fetchLiveExperience("123", (() => Promise.reject(new Error("down"))) as unknown as typeof fetch, 1);
    expect(f.unavailable).toBe(true);
    expect(f.visits).toBeNull();
  });
});

describe("Pricing and seller financials", () => {
  it("reserve is optional and validated only when enabled", () => {
    expect(validateReserve(false, 0, 50000)).toBeNull();
    expect(validateReserve(true, 1000, 50000)).toMatch(/below the starting bid/);
    expect(validateReserve(true, 50000, 50000)).toBeNull();
  });
  it("revenue not provided reads as null; legacy listings count as seller-provided", () => {
    expect(sellerRevenue({ financialsProvided: false, monthlyRevenue: 999 })).toBeNull();
    expect(sellerRevenue({ financialsProvided: undefined, monthlyRevenue: 6800 })).toBe(6800);
    expect(SELLER_PROVIDED_NOTE).toBe("* Seller-provided information; not independently verified by bestottr.");
  });
});

describe("Seller profile", () => {
  it("profile shows current listings, reviews and numeric Roblox profile link", async () => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() }, history: createMemoryHistory({ initialEntries: ["/user/kenzo_labs"] }) });
    render(<RouterProvider router={router} />);
    const link = await screen.findByRole("link", { name: /View Roblox profile/ });
    expect(link).toHaveAttribute("href", "https://www.roblox.com/users/90412277/profile");
    expect(link).toHaveAttribute("target", "_blank");
    expect(screen.getByText(/Current listings/)).toBeInTheDocument();
    expect(screen.getByText("Forgeline Studios Community")).toBeInTheDocument();
    expect(screen.getByText(reviewsFor("kenzo_labs")[0]!.text)).toBeInTheDocument();
  });
});
