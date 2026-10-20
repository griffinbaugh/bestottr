// Best-effort Community banner/header extraction from the public Roblox Community page.
// Not a documented API contract and never ownership evidence. Pure parsing + an injectable fetcher.

export type BannerSource = "community_page" | "demo" | "none";
export type CommunityPageMedia = { bannerUrl: string | null; pageMediaUrls: string[]; bannerSource: BannerSource };

export const MAX_PAGE_MEDIA = 5;
const EMPTY: CommunityPageMedia = { bannerUrl: null, pageMediaUrls: [], bannerSource: "none" };

const IMAGE_HOST = /(^|\.)rbxcdn\.com$|(^|\.)roblox\.com$/i;
const PAGE_HOST = /^(www\.|web\.|m\.)?roblox\.com$/i;
const BANNER_HINT = /banner|cover|header|hero|background-image|backgroundimage|og:image/i;

/** https + rbxcdn/roblox image host only; rejects data:, javascript:, and third-party hosts. */
export function safeRobloxImageUrl(raw: string): string | null {
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:" || !IMAGE_HOST.test(u.hostname) || u.username || u.password) return null;
    return u.toString();
  } catch {
    return null;
  }
}

/** Decode HTML entities and JSON/JS escapes so embedded URLs become plain text. */
export function decodeEmbedded(html: string): string {
  return html
    .replace(/\\u002[fF]/g, "/").replace(/\\u0026/g, "&").replace(/\\u003[dD]/g, "=")
    .replace(/\\\//g, "/")
    .replace(/&quot;|&#34;|&#x22;/gi, '"').replace(/&#39;|&#x27;|&apos;/gi, "'")
    .replace(/&#x2[fF];|&#47;/g, "/").replace(/&amp;/g, "&");
}

/** Width/height from Roblox thumbnail URLs like tr.rbxcdn.com/{hash}/768/432/Image/Png. */
const dims = (url: string): [number, number] | null => {
  const m = /\/(\d{2,4})\/(\d{2,4})\/(?:Image|AvatarHeadshot|Avatar|GroupIcon|Png|Webp|Jpeg)/i.exec(url) ?? /[?&]w(?:idth)?=(\d+).*?[?&]h(?:eight)?=(\d+)/i.exec(url);
  return m ? [Number(m[1]), Number(m[2])] : null;
};

/**
 * Extract wide Community header/banner candidates from page HTML.
 * Square images (the group icon) are excluded; `excludeUrls` drops the official icon too.
 */
export function extractCommunityPageMedia(html: string, excludeUrls: (string | null | undefined)[] = []): CommunityPageMedia {
  if (!html) return EMPTY;
  const text = decodeEmbedded(html);
  const exclude = new Set(excludeUrls.filter(Boolean).map((u) => u!.split("?")[0]));
  const found = new Map<string, number>();
  const re = /https:\/\/[a-z0-9.-]+\.(?:rbxcdn\.com|roblox\.com)\/[^\s"'()<>\\]+/gi;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    const url = safeRobloxImageUrl(m[0].replace(/[),;.]+$/, ""));
    if (!url || exclude.has(url.split("?")[0]) || found.has(url)) continue;
    const isImage = /rbxcdn\.com/i.test(url) || /\.(png|jpe?g|webp)(\?|$)/i.test(url);
    if (!isImage) continue;
    const d = dims(url);
    if (d && d[0] <= d[1] * 1.2) continue; // square/portrait → icon or avatar, never a banner
    const ctx = text.slice(Math.max(0, m.index - 160), m.index);
    let score = 0;
    if (d) score += d[0] / d[1] >= 1.5 ? 3 : 1;
    if (BANNER_HINT.test(ctx)) score += 2;
    if (!d && score === 0) continue; // unknown shape with no banner context: too risky
    found.set(url, score);
  }
  const ranked = [...found.entries()].sort((a, b) => b[1] - a[1]).map(([u]) => u).slice(0, MAX_PAGE_MEDIA);
  return ranked.length ? { bannerUrl: ranked[0]!, pageMediaUrls: ranked, bannerSource: "community_page" } : EMPTY;
}

/** Fetch https://www.roblox.com/communities/{id} (server-side fetch sends no cookies), following redirects only within Roblox. */
export async function fetchCommunityPageMedia(groupId: string, request: typeof fetch = fetch, excludeUrls: (string | null)[] = []): Promise<CommunityPageMedia> {
  let url = `https://www.roblox.com/communities/${groupId}`;
  try {
    for (let hop = 0; hop < 4; hop++) {
      const r = await request(url, { redirect: "manual", headers: { accept: "text/html" }, signal: AbortSignal.timeout(6000) });
      if (r.status >= 300 && r.status < 400) {
        const next = new URL(r.headers.get("location") ?? "", url);
        if (next.protocol !== "https:" || !PAGE_HOST.test(next.hostname)) return EMPTY;
        url = next.toString();
        continue;
      }
      if (!r.ok) return EMPTY;
      return extractCommunityPageMedia(await r.text(), excludeUrls);
    }
  } catch { /* markup/network change → neutral fallback */ }
  return EMPTY;
}
