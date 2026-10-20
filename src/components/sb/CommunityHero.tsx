import { BadgeCheck, Users } from "lucide-react";
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

/** Banner (or neutral blank) with the Community icon centered on top in a subtle raised tile. */
export function CommunityBanner({ c, size = "card", className }: { c: Pick<CommunityIdentity, "name" | "iconUrl" | "bannerUrl" | "verified">; size?: "card" | "hero"; className?: string }) {
  const icon = size === "hero" ? "h-24 w-24 md:h-28 md:w-28" : "h-16 w-16";
  return (
    <div data-testid="community-banner" className={cn("relative flex h-full w-full items-center justify-center overflow-hidden bg-muted", className)}>
      {c.bannerUrl ? (
        <img src={img(c.bannerUrl)} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" data-testid="community-banner-image" />
      ) : (
        <div data-testid="community-banner-blank" className="absolute inset-0 bg-secondary" aria-hidden />
      )}
      {c.bannerUrl && <div className="absolute inset-0 bg-background/30" aria-hidden />}
      <div className={cn("relative overflow-hidden rounded-xl border border-border bg-card shadow-lg", icon)}>
        {c.iconUrl ? (
          <img src={img(c.iconUrl)} alt={`${c.name} icon`} loading="lazy" className="h-full w-full object-cover" data-testid="community-icon" />
        ) : (
          <span data-testid="community-icon" className="flex h-full w-full items-center justify-center text-xl font-semibold uppercase text-muted-foreground"><Users className="h-6 w-6" /></span>
        )}
      </div>
    </div>
  );
}
