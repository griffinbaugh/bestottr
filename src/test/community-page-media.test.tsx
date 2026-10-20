import { describe, expect, it, beforeEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { extractCommunityPageMedia, fetchCommunityPageMedia, safeRobloxImageUrl } from "@/lib/community-page-media";
import { fetchLiveCommunity } from "@/lib/roblox-live";
import { CommunityBanner, COMMUNITY_ICON_OVERHANG, COMMUNITY_ICON_RATIO, RobloxVerifiedBadge } from "@/components/sb/CommunityHero";

beforeEach(() => cleanup());

const ICON = "https://tr.rbxcdn.com/180DAY-icon/420/420/Image/Png/noFilter";
const WIDE = "https://tr.rbxcdn.com/180DAY-banner/1200/400/Image/Webp/noFilter";

describe("Community page media extraction", () => {
  it("picks the wide rbxcdn banner over the square icon", () => {
    const html = `<meta property="og:image" content="${ICON}"><img src="${ICON}"><div class="group-banner"><img src="${WIDE}"></div>`;
    const m = extractCommunityPageMedia(html);
    expect(m.bannerUrl).toBe(WIDE);
    expect(m.pageMediaUrls).toEqual([WIDE]);
    expect(m.bannerSource).toBe("community_page");
  });
  it("rejects third-party, data and javascript URLs", () => {
    expect(safeRobloxImageUrl("https://evil.com/1200/400/Image/a.png")).toBeNull();
    expect(safeRobloxImageUrl("https://rbxcdn.com.evil.io/x/1200/400/Image")).toBeNull();
    expect(safeRobloxImageUrl("http://tr.rbxcdn.com/x/1200/400/Image")).toBeNull();
    expect(safeRobloxImageUrl("javascript:alert(1)")).toBeNull();
    const m = extractCommunityPageMedia(`<div class="banner" style="background-image:url(https://evil.com/b/1200/400/Image/Png)"></div><img src="data:image/png;base64,AAAA">`);
    expect(m.bannerUrl).toBeNull();
  });
  it("decodes escaped JSON and CSS background-image candidates", () => {
    const json = `<script>window.__state={"bannerUrl":"https:\\/\\/tr.rbxcdn.com\\/180DAY-j\\/1920\\/480\\/Image\\/Png\\/noFilter"}</script>`;
    expect(extractCommunityPageMedia(json).bannerUrl).toBe("https://tr.rbxcdn.com/180DAY-j/1920/480/Image/Png/noFilter");
    const css = `<div class="header" style="background-image: url(&quot;https://t0.rbxcdn.com/cover-abc.png&quot;)"></div>`;
    expect(extractCommunityPageMedia(css).bannerUrl).toBe("https://t0.rbxcdn.com/cover-abc.png");
    const uni = `{"u":"https:\\u002F\\u002Ftr.rbxcdn.com\\u002Fx\\u002F768\\u002F432\\u002FImage\\u002FPng"}`;
    expect(extractCommunityPageMedia(uni).bannerUrl).toBe("https://tr.rbxcdn.com/x/768/432/Image/Png");
  });
  it("returns an empty result when nothing qualifies", () => {
    expect(extractCommunityPageMedia("")).toEqual({ bannerUrl: null, pageMediaUrls: [], bannerSource: "none" });
    expect(extractCommunityPageMedia(`<img src="${ICON}">`).bannerUrl).toBeNull();
  });
  it("follows redirects only within Roblox", async () => {
    const offsite = (async () => new Response(null, { status: 302, headers: { location: "https://evil.com/x" } })) as unknown as typeof fetch;
    expect((await fetchCommunityPageMedia("1", offsite)).bannerUrl).toBeNull();
    let hops = 0;
    const onsite = (async () => (hops++ === 0 ? new Response(null, { status: 301, headers: { location: "/communities/1/Name" } }) : new Response(`<div class="banner"><img src="${WIDE}"></div>`))) as unknown as typeof fetch;
    expect((await fetchCommunityPageMedia("1", onsite)).bannerUrl).toBe(WIDE);
  });
});

describe("Live Community facts merge", () => {
  const req = (pageOk: boolean) => (async (url: string) => {
    if (url.includes("thumbnails")) return new Response(JSON.stringify({ data: [{ state: "Completed", imageUrl: ICON }] }));
    if (url.includes("groups.roblox.com")) return new Response(JSON.stringify({ id: 999, name: "Live Co", owner: { userId: 5, username: "own" }, memberCount: 10, hasVerifiedBadge: false }));
    if (!pageOk) throw new Error("down");
    return new Response(`<meta property="og:image" content="${ICON}"><div class="banner"><img src="${WIDE}"></div>`);
  }) as unknown as typeof fetch;
  it("icon comes from the thumbnail endpoint and banner from the page", async () => {
    const f = await fetchLiveCommunity("999", req(true), 1);
    expect(f).toMatchObject({ iconUrl: ICON, bannerUrl: WIDE, bannerSource: "community_page", ownerUserId: "5", unavailable: false });
  });
  it("page failure leaves bannerUrl null so the saved snapshot remains the fallback", async () => {
    const f = await fetchLiveCommunity("999", req(false), 1);
    expect(f).toMatchObject({ iconUrl: ICON, bannerUrl: null, bannerSource: "none", unavailable: false });
  });
});

describe("Community banner geometry", () => {
  const tile = () => screen.getByTestId("community-icon-tile");
  it("icon is ~70% of banner height, bottom-centered and overhanging the edge", () => {
    render(<CommunityBanner c={{ name: "N", iconUrl: "c1", bannerUrl: "cb1", verified: true }} />);
    expect(COMMUNITY_ICON_RATIO).toBe(0.7);
    expect(COMMUNITY_ICON_OVERHANG).toBeGreaterThanOrEqual(0.35);
    expect(COMMUNITY_ICON_OVERHANG).toBeLessThanOrEqual(0.45);
    expect(tile().style.height).toBe("70%");
    expect(tile().style.transform).toBe("translate(-50%, 40%)");
    expect(tile().className).toMatch(/bottom-0/);
    expect(tile().className).toMatch(/left-1\/2/);
    expect(screen.getByTestId("community-banner-image")).toBeInTheDocument();
    expect(screen.queryByTestId("roblox-verified")).toBeNull();
    expect(screen.getByTestId("community-icon-spacer").style.paddingTop).not.toBe("");
  });
  it("blank banner keeps the same large overlapping icon, placeholder when no icon", () => {
    render(<CommunityBanner c={{ name: "N", iconUrl: null, bannerUrl: null, verified: false }} size="hero" />);
    expect(screen.getByTestId("community-banner-blank")).toBeInTheDocument();
    expect(tile().style.height).toBe("70%");
    expect(tile().style.transform).toBe("translate(-50%, 40%)");
    expect(screen.getByTestId("community-icon")).toBeInTheDocument();
  });
  it("verified badge still renders as readable text", () => {
    render(<RobloxVerifiedBadge />);
    expect(screen.getByTestId("roblox-verified")).toHaveTextContent("Roblox verified");
  });
});
