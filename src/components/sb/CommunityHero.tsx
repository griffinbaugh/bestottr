import { BadgeCheck, Users } from "lucide-react";
import { useSyncExternalStore } from "react";
import type { CommunityIdentity } from "@/lib/community";
import { img } from "@/lib/images";
import { cn } from "@/lib/utils";

export function RobloxVerifiedBadge({ className }: { className?: string }) {
  return (
    <span data-testid="roblox-verified" title="Verified by Roblox" className={cn("inline-flex items-center gap-1 text-xs font-medium text-brand", className)}>
      <BadgeCheck className="h-3.5 w-3.5" aria-hidden />
      <span>Roblox verified</span>
    </span>
  );
}

/** Shared overlap geometry: icon is 70% of banner height, 40% of it hangs below the banner edge. */
export const COMMUNITY_ICON_RATIO = 0.7;
export const COMMUNITY_ICON_OVERHANG = 0.4;
export const COMMUNITY_ASPECT = { card: 16 / 9, hero: 16 / 6 } as const;

// Fresh live banners (from LiveCommunityData refreshes) override saved snapshots for display only.
const fresh = new Map<string, Pick<CommunityIdentity, "bannerUrl" | "iconUrl">>();
const subs = new Set<() => void>();
export function publishFreshCommunityMedia(groupId: string, m: Pick<CommunityIdentity, "bannerUrl" | "iconUrl">) {
  fresh.set(groupId, m);
  subs.forEach((f) => f());
}
const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };

type BannerCommunity = Pick<CommunityIdentity, "name" | "iconUrl" | "bannerUrl" | "verified"> & { groupId?: string };

/** Full-width banner (or neutral blank) with the square icon centered across its bottom edge. */
export function CommunityBanner({ c, size = "card", className }: { c: BannerCommunity; size?: "card" | "hero"; className?: string }) {
  const live = useSyncExternalStore(subscribe, () => (c.groupId ? fresh.get(c.groupId) : undefined), () => undefined);
  const bannerUrl = live?.bannerUrl ?? c.bannerUrl;
  const iconUrl = live?.iconUrl ?? c.iconUrl;
  const aspect = COMMUNITY_ASPECT[size];
  // Spacer height as % of width = overhang × icon height = OVERHANG × RATIO × (width / aspect).
  const spacer = `${(COMMUNITY_ICON_OVERHANG * COMMUNITY_ICON_RATIO * 100) / aspect}%`;
  return (
    <div data-testid="community-media" data-size={size} className={cn("relative w-full", className)}>
      <div className="relative w-full" style={{ aspectRatio: String(aspect) }} data-testid="community-banner">
        <div className="absolute inset-0 overflow-hidden bg-muted">
          {bannerUrl ? (
            <img src={img(bannerUrl)} alt="" loading="lazy" className="h-full w-full object-cover" data-testid="community-banner-image" />
          ) : (
            <div data-testid="community-banner-blank" className="h-full w-full bg-secondary" aria-hidden />
          )}
        </div>
        <div
          data-testid="community-icon-tile"
          className={cn("absolute bottom-0 left-1/2 z-10 aspect-square overflow-hidden border border-border bg-card shadow-lg", size === "hero" ? "rounded-[14px]" : "rounded-[10px]")}
          style={{ height: `${COMMUNITY_ICON_RATIO * 100}%`, transform: `translate(-50%, ${COMMUNITY_ICON_OVERHANG * 100}%)` }}
        >
          {iconUrl ? (
            <img src={img(iconUrl)} alt={`${c.name} icon`} loading="lazy" className="h-full w-full object-cover" data-testid="community-icon" />
          ) : (
            <span data-testid="community-icon" className="flex h-full w-full items-center justify-center text-muted-foreground"><Users className="h-1/3 w-1/3" /></span>
          )}
        </div>
      </div>
      <div aria-hidden data-testid="community-icon-spacer" style={{ paddingTop: spacer }} />
    </div>
  );
}
