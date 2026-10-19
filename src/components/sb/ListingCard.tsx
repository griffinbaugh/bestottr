import { Link } from "@tanstack/react-router";
import { BadgeCheck, Heart, Users } from "lucide-react";
import type { Listing } from "@/lib/data";
import { compact, usdCompact } from "@/lib/format";
import { img } from "@/lib/images";
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
  return (
    <div className="surface lift group relative flex flex-col overflow-hidden">
      <Link to="/listing/$id" params={{ id: l.id }} className="relative block aspect-video overflow-hidden bg-muted">
        <img src={img(l.image)} alt={l.title} loading="lazy" width={1088} height={608} className="h-full w-full object-cover" />
        <div className="absolute left-3 top-3 flex gap-1.5">
          {l.format === "auction" && live ? (
            <Badge tone="overlay">
              <span className="h-1.5 w-1.5 rounded-full bg-live" /> <Countdown endsAt={l.endsAt} />
            </Badge>
          ) : (
            <Badge tone="overlay">{live ? "Buy now" : l.status === "sold" ? "Sold" : l.status === "review" ? "In review" : "Ended"}</Badge>
          )}
        </div>
      </Link>
      <button
        aria-label={watched ? "Remove from watchlist" : "Add to watchlist"}
        onClick={() => actions.toggleWatch(l.id)}
        className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-overlay text-overlay-foreground backdrop-blur"
      >
        <Heart className={cn("h-4 w-4", watched && "fill-current")} />
      </button>
      <Link to="/listing/$id" params={{ id: l.id }} className="flex flex-1 flex-col p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="truncate">{l.seller.name}</span>
          {isFullyVerified(l) && <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-brand" aria-label="Verified" />}
          <span className="ml-auto shrink-0">{l.genre}</span>
        </div>
        <h3 className="mt-1 truncate font-semibold tracking-tight">{l.title}</h3>
        <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
          <span className="num">{usdCompact(l.monthlyRevenue)}/mo revenue</span>
          <span className="num inline-flex items-center gap-1"><Users className="h-3 w-3" />{compact(l.ccu)} CCU</span>
        </div>
        <div className="mt-auto flex items-end justify-between pt-3">
          <div>
            <div className="text-xs text-muted-foreground">{l.format === "auction" ? (l.bids.length ? `Current bid · ${l.bids.length} bids` : "Starting bid") : "Asking price"}</div>
            <div className="num text-lg font-semibold">{usdCompact(l.format === "auction" ? l.currentBid : (l.buyNow ?? l.currentBid))}</div>
          </div>
        </div>
      </Link>
    </div>
  );
}
