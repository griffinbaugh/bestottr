import { Link } from "@tanstack/react-router";
import { BadgeCheck, FileDown, Heart, Users } from "lucide-react";
import type { Listing } from "@/lib/data";
import { compact, usdCompact } from "@/lib/format";
import { coverImage } from "@/lib/gallery";
import { sellerRevenue } from "@/lib/financials";
import { ListingImage } from "./ListingImage";
import { CommunityBanner, RobloxVerifiedBadge } from "./CommunityHero";
import { SellerLink } from "./SellerLink";
import { stockLabel } from "@/lib/inventory";
import { actions, useAppState } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Badge } from "./ui";
import { Countdown } from "./Countdown";

export function isFullyVerified(l: Listing) {
  return l.verified.ownership && l.verified.revenue && l.verified.traffic;
}

export function ListingCard({ listing: l }: { listing: Listing }) {
  const { watchlist } = useAppState();
  const watched = watchlist.includes(l.id);
  const live = l.status === "live";
  const isFile = l.kind === "file";
  const isCommunity = l.kind === "community" && !!l.community;
  const soldOut = isFile && l.file?.inventory.mode === "limited" && l.file.inventory.remaining <= 0;
  const rev = sellerRevenue(l);
  return (
    <div className="surface lift group relative flex flex-col overflow-hidden" data-testid={isCommunity ? "community-card" : "listing-card"}>
      <Link to="/listing/$id" params={{ id: l.id }} className={isCommunity ? "relative block" : "relative block aspect-video overflow-hidden bg-muted"}>
        {isCommunity ? <CommunityBanner c={l.community!} /> : <ListingImage image={coverImage(l)} alt={l.title} loading="lazy" width={1088} height={608} className="h-full w-full object-cover" />}
        <div className="absolute left-3 top-3 flex gap-1.5">
          {l.format === "auction" && live ? (
            <Badge tone="overlay">
              <span className="h-1.5 w-1.5 rounded-full bg-live" /> <Countdown endsAt={l.endsAt} />
            </Badge>
          ) : (
            <Badge tone="overlay">
              {soldOut || l.status === "sold" ? (isFile ? "Sold out" : "Sold") : live ? "Buy now" : l.status === "review" ? "In review" : "Ended"}
            </Badge>
          )}
          {isFile && <Badge tone="overlay"><FileDown className="h-3 w-3" /> File</Badge>}
          {isCommunity && <Badge tone="overlay"><Users className="h-3 w-3" /> Community</Badge>}
        </div>
      </Link>
      <button
        aria-label={watched ? "Remove from watchlist" : "Add to watchlist"}
        onClick={() => actions.toggleWatch(l.id)}
        className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-overlay text-overlay-foreground backdrop-blur transition-transform duration-150 ease-out hover:scale-105 active:scale-95"
      >
        <Heart className={cn("h-4 w-4", watched && "fill-current")} />
      </button>
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <SellerLink handle={l.seller.handle} className="truncate hover:text-foreground hover:underline">{l.seller.name}</SellerLink>
          {(isFile ? l.seller.verified : isFullyVerified(l)) && <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-brand" aria-label="Verified" />}
          <span className="ml-auto shrink-0">{isFile && l.file ? `${l.file.category} · ${l.file.fileType}` : isCommunity ? "Roblox Community" : l.genre}</span>
        </div>
        <Link to="/listing/$id" params={{ id: l.id }} className="flex flex-1 flex-col">
          <div className="mt-1 flex min-w-0 items-center gap-2">
            <h3 className="truncate font-semibold tracking-tight">{l.title}</h3>
            {isCommunity && l.community!.verified && <RobloxVerifiedBadge className="shrink-0" />}
          </div>
          <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
            {isFile && l.file ? (
              <>
                <span className="num">{l.file.fileSize} · v{l.file.version}</span>
                <span className={cn("num", soldOut ? "text-warning" : live && l.file.inventory.mode === "limited" && "text-brand")}>{stockLabel(l.file.inventory)}</span>
              </>
            ) : (
              <>
                <span className="num">{rev === null ? "Revenue not provided" : `${usdCompact(rev)}/mo revenue*`}</span>
                {isCommunity
                  ? <span className="num inline-flex items-center gap-1"><Users className="h-3 w-3" />{l.community!.memberCount === null ? "—" : compact(l.community!.memberCount)} members</span>
                  : <span className="num inline-flex items-center gap-1"><Users className="h-3 w-3" />{compact(l.ccu)} CCU</span>}
              </>
            )}
          </div>
          <div className="mt-auto flex items-end justify-between pt-3">
            <div>
              <div className="text-xs text-muted-foreground">{l.format === "auction" ? (l.bids.length ? `Current bid · ${l.bids.length} bids` : "Starting bid") : "Price"}</div>
              <div className="num text-lg font-semibold">{usdCompact(l.format === "auction" ? l.currentBid : (l.buyNow ?? l.currentBid))}</div>
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}
