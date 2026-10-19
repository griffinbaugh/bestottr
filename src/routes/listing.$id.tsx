import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AlertTriangle, BadgeCheck, Check, Download, FileDown, Heart, ShieldCheck, Star, Trophy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { BidDialog } from "@/components/sb/BidDialog";
import { Countdown, useNow } from "@/components/sb/Countdown";
import { Badge, Button, Empty, Stat, buttonVariants } from "@/components/sb/ui";
import { LICENSE_TERMS, ME } from "@/lib/data";
import { ago, compact, usd } from "@/lib/format";
import { img } from "@/lib/images";
import { stockLabel } from "@/lib/inventory";
import { minNextBid } from "@/lib/pricing";
import { actions, useAppState } from "@/lib/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/listing/$id")({
  head: () => ({
    meta: [
      { title: "Listing details — bestottr" },
      { name: "description", content: "Verified metrics, financials, bid history and seller details for this listing." },
      { property: "og:title", content: "Listing details — bestottr" },
      { property: "og:description", content: "Verified metrics, financials and bid history." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ListingPage,
});

function ListingPage() {
  const { id } = Route.useParams();
  const s = useAppState();
  const navigate = useNavigate();
  const now = useNow();
  const [bidOpen, setBidOpen] = useState(false);
  const l = s.listings.find((x) => x.id === id);
  if (!l) return <div className="mx-auto max-w-3xl px-4 py-16"><Empty title="Listing not found" body="It may have been removed." action={<Link to="/browse" search={{ q: "" }} className={buttonVariants({ variant: "outline" })}>Back to marketplace</Link>} /></div>;

  const deal = s.deals.find((d) => d.listingId === l.id);
  const watched = s.watchlist.includes(l.id);
  const ended = l.status !== "live" || (now !== null && l.endsAt < now);
  const isAuction = l.format === "auction";
  const top = l.bids[0];
  const youLead = top?.bidder === ME;
  const reserveMet = !l.reserve || l.currentBid >= l.reserve;
  const mine = l.seller.handle === ME;

  const goDeal = (dealId: string) => navigate({ to: "/deal/$id", params: { id: dealId } });

  if (l.kind === "file" && l.file) {
    return <FileListing l={l} ended={ended} mine={mine} watched={watched} deal={deal} goDeal={goDeal} />;
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-8">
      <div className="mb-4 text-sm text-muted-foreground">
        <Link to="/browse" search={{ q: "" }} className="hover:text-foreground">Marketplace</Link> / {l.genre}
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="min-w-0 space-y-6">
          <div className="surface overflow-hidden">
            <img src={img(l.image)} alt={l.title} width={1088} height={608} className="aspect-video w-full object-cover" />
          </div>
          <div>
            <div className="flex flex-wrap gap-2">
              <Badge tone={l.verified.ownership ? "brand" : "warning"}><BadgeCheck className="h-3.5 w-3.5" />Ownership {l.verified.ownership ? "verified" : "unverified"}</Badge>
              <Badge tone={l.verified.revenue ? "brand" : "warning"}>{l.verified.revenue ? <Check className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}Revenue {l.verified.revenue ? "verified" : "unverified"}</Badge>
              <Badge tone={l.verified.traffic ? "brand" : "warning"}>{l.verified.traffic ? <Check className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}Traffic {l.verified.traffic ? "verified" : "unverified"}</Badge>
            </div>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight md:text-3xl">{l.title}</h1>
            <p className="mt-2 text-muted-foreground">{l.tagline}</p>
          </div>

          <div className="surface grid grid-cols-2 gap-x-5 gap-y-6 p-5 sm:grid-cols-4">
            <Stat label="Revenue / mo" value={usd(l.monthlyRevenue)} hint="Trailing 90-day avg" />
            <Stat label="Profit / mo" value={usd(l.monthlyProfit)} hint={`${Math.round((l.monthlyProfit / l.monthlyRevenue) * 100)}% margin`} />
            <Stat label="Visits / mo" value={compact(l.monthlyVisits)} />
            <Stat label="Avg CCU" value={compact(l.ccu)} />
            <Stat label="Favorites" value={compact(l.favorites)} />
            <Stat label="Age" value={`${l.ageMonths} months`} />
            <Stat label="Multiple" value={`${(l.currentBid / (l.monthlyProfit * 12)).toFixed(2)}x`} hint="Annual profit" />
            <Stat label="Annual profit" value={usd(l.monthlyProfit * 12)} />
          </div>

          <Section title="About this experience"><p className="text-sm leading-relaxed text-muted-foreground">{l.description}</p></Section>

          <Section title="Monetization breakdown">
            <div className="space-y-3">
              {l.monetization.map((m) => (
                <div key={m.label}>
                  <div className="flex justify-between text-sm"><span>{m.label}</span><span className="num text-muted-foreground">{m.pct}% · {usd(Math.round((l.monthlyRevenue * m.pct) / 100))}/mo</span></div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-foreground" style={{ width: `${m.pct}%` }} /></div>
                </div>
              ))}
            </div>
          </Section>

          <div className="grid gap-6 md:grid-cols-2">
            <Section title="Included assets">
              <ul className="space-y-2 text-sm">
                {l.assets.map((a) => <li key={a} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-brand" />{a}</li>)}
              </ul>
            </Section>
            <Section title="Risks & notes">
              {l.risks.length ? (
                <ul className="space-y-2 text-sm">
                  {l.risks.map((r) => <li key={r} className="flex gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />{r}</li>)}
                </ul>
              ) : <p className="text-sm text-muted-foreground">No material risks disclosed by the seller.</p>}
            </Section>
          </div>

          {isAuction && (
            <Section title={`Bid history (${l.bids.length})`}>
              {l.bids.length ? (
                <div className="divide-y divide-border text-sm">
                  {l.bids.map((b, i) => (
                    <div key={b.id + i} className="flex items-center justify-between py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-secondary text-xs font-semibold uppercase">{b.bidder.slice(0, 2)}</span>
                        <span className={cn(b.bidder === ME && "font-semibold")}>{b.bidder === ME ? "You" : b.bidder}</span>
                        {i === 0 && <Badge tone="brand">Leading</Badge>}
                      </div>
                      <div className="text-right">
                        <div className="num font-medium">{usd(b.amount)}</div>
                        <div className="text-xs text-muted-foreground">{now ? ago(b.at, now) : ""}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : <p className="text-sm text-muted-foreground">No bids yet. Be the first.</p>}
            </Section>
          )}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20 lg:h-fit">
          <div className="surface p-5">
            {isAuction ? (
              <>
                <div className="flex items-center justify-between">
                  <span className="eyebrow">{ended ? "Auction ended" : "Auction ends in"}</span>
                  {!ended && <Badge tone="live"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-live" />Live</Badge>}
                </div>
                <Countdown endsAt={l.endsAt} className="mt-1 block text-2xl font-semibold" />
                <div className="mt-5 eyebrow">Current bid</div>
                <div className="num text-4xl font-semibold tracking-tight">{usd(l.currentBid)}</div>
                <div className="mt-1 flex flex-wrap gap-x-3 text-sm text-muted-foreground">
                  <span>{l.bids.length} bids</span>
                  {l.reserve && <span className={reserveMet ? "text-brand" : "text-warning"}>{reserveMet ? "Reserve met" : "Reserve not met"}</span>}
                </div>
                {youLead && !ended && <div className="mt-3 rounded-md bg-brand-soft px-3 py-2 text-sm font-medium text-brand">You're the highest bidder</div>}
                {!youLead && l.bids.some((b) => b.bidder === ME) && !ended && <div className="mt-3 rounded-md bg-live-soft px-3 py-2 text-sm font-medium text-live">You've been outbid</div>}
                {!ended && !mine && (
                  <>
                    <Button size="lg" className="mt-4 w-full" onClick={() => setBidOpen(true)}>Place bid · min {usd(minNextBid(l.currentBid, l.bids.length > 0, l.startingBid))}</Button>
                    {l.buyNow && (
                      <Button size="lg" variant="outline" className="mt-2 w-full" onClick={() => { const d = actions.buyNow(l.id); toast.success("Purchased — deal room opened"); goDeal(d); }}>
                        Buy now · {usd(l.buyNow)}
                      </Button>
                    )}
                  </>
                )}
              </>
            ) : (
              <>
                <div className="eyebrow">Asking price</div>
                <div className="num text-4xl font-semibold tracking-tight">{usd(l.buyNow ?? l.currentBid)}</div>
                {!ended && !mine && (
                  <Button size="lg" className="mt-4 w-full" onClick={() => { const d = actions.buyNow(l.id); toast.success("Purchased — deal room opened"); goDeal(d); }}>Buy now</Button>
                )}
              </>
            )}
            {mine && <div className="mt-4 rounded-md bg-secondary px-3 py-2 text-sm">This is your listing.</div>}
            {deal && (
              <Link to="/deal/$id" params={{ id: deal.id }} className={buttonVariants({ variant: "brand", size: "lg", className: "mt-4 w-full" })}>
                Open deal room
              </Link>
            )}
            <Button variant="ghost" className="mt-2 w-full" onClick={() => actions.toggleWatch(l.id)}>
              <Heart className={cn("h-4 w-4", watched && "fill-current")} /> {watched ? "Watching" : "Add to watchlist"}
            </Button>
          </div>

          {isAuction && !ended && !mine && !deal && (
            <div className="rounded-xl border border-dashed border-warning bg-warning-soft p-4">
              <div className="text-sm font-semibold">Demo controls</div>
              <p className="mt-1 text-xs text-muted-foreground">Skip the wait: close this auction with you as the winning bidder (at or above reserve).</p>
              <Button variant="demo" className="mt-3 w-full" onClick={() => { const d = actions.winAuction(l.id); toast.success("You won the auction!", { description: "Your private deal room is open." }); goDeal(d); }}>
                <Trophy className="h-4 w-4" /> Demo: win auction
              </Button>
            </div>
          )}

          <SellerCard l={l} />
        </aside>
      </div>
      <BidDialog listing={l} open={bidOpen} onOpenChange={setBidOpen} />
    </div>
  );
}

type ListingT = NonNullable<ReturnType<typeof useAppState>["listings"][number]>;

function FileListing({ l, ended, mine, watched, deal, goDeal }: {
  l: ListingT;
  ended: boolean;
  mine: boolean;
  watched: boolean;
  deal: { id: string } | undefined;
  goDeal: (id: string) => void;
}) {
  const [bidOpen, setBidOpen] = useState(false);
  const f = l.file!;
  const inv = f.inventory;
  const soldOut = inv.mode === "limited" && inv.remaining <= 0;
  const purchasable = !ended && !soldOut && !mine;
  const isAuction = l.format === "auction";

  const buy = () => {
    const r = actions.buyFile(l.id);
    if (!r.ok) {
      toast.error(r.error ?? "Purchase failed");
      return;
    }
    toast.success("Purchase complete — file access granted", { description: "Your file is ready to download instantly." });
    goDeal(r.dealId!);
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-8">
      <div className="mb-4 text-sm text-muted-foreground">
        <Link to="/browse" search={{ q: "" }} className="hover:text-foreground">Marketplace</Link> / Files / {f.category}
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="min-w-0 space-y-6">
          <div className="surface overflow-hidden">
            <img src={img(l.image)} alt={l.title} width={1088} height={608} className="aspect-video w-full object-cover" />
          </div>
          <div>
            <div className="flex flex-wrap gap-2">
              <Badge tone="brand"><FileDown className="h-3.5 w-3.5" />{f.category}</Badge>
              <Badge tone="neutral">{f.fileType} · {f.fileSize}</Badge>
              <Badge tone="neutral">v{f.version}</Badge>
              {isAuction && <Badge tone="outline">Single exclusive copy</Badge>}
              {l.seller.verified && <Badge tone="brand"><BadgeCheck className="h-3.5 w-3.5" />Verified seller</Badge>}
            </div>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight md:text-3xl">{l.title}</h1>
            <p className="mt-2 text-muted-foreground">{l.tagline}</p>
          </div>

          <div className="surface grid grid-cols-2 gap-x-5 gap-y-6 p-5 sm:grid-cols-4">
            <Stat label="File" value={f.fileType} hint={f.fileSize} />
            <Stat label="Version" value={`v${f.version}`} />
            <Stat label="Category" value={f.category} />
            <Stat label="Availability" value={stockLabel(inv)} hint={inv.mode === "limited" ? `of ${inv.total} licenses` : "always in stock"} />
          </div>

          <Section title="About this file"><p className="text-sm leading-relaxed text-muted-foreground">{l.description}</p></Section>

          <div className="grid gap-6 md:grid-cols-2">
            <Section title="Included files">
              <ul className="space-y-2 text-sm">
                {f.includedFiles.map((a) => <li key={a} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-brand" />{a}</li>)}
              </ul>
            </Section>
            <Section title="Compatibility">
              <p className="text-sm text-muted-foreground">{f.compatibility}</p>
              <div className="mt-4 border-t border-border pt-4">
                <div className="eyebrow mb-1">Seller notes</div>
                <p className="text-sm text-muted-foreground">{f.sellerNotes}</p>
              </div>
            </Section>
          </div>

          <Section title="License & usage terms">
            <p className="text-sm leading-relaxed text-muted-foreground">{f.license}</p>
            <p className="mt-3 flex gap-2 rounded-md bg-secondary p-3 text-xs text-muted-foreground">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />{LICENSE_TERMS}
            </p>
          </Section>

          <Section title="Delivery & buyer protection">
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-brand" />Payment is held in escrow until you confirm successful download.</li>
              <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-brand" />The seller releases file access inside the deal room after payment.</li>
              <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-brand" />Funds release to the seller only after your confirmation.</li>
            </ul>
          </Section>

          {isAuction && (
            <Section title={`Bid history (${l.bids.length})`}>
              {l.bids.length ? (
                <div className="divide-y divide-border text-sm">
                  {l.bids.map((b, i) => (
                    <div key={b.id + i} className="flex items-center justify-between py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-secondary text-xs font-semibold uppercase">{b.bidder.slice(0, 2)}</span>
                        <span className={cn(b.bidder === ME && "font-semibold")}>{b.bidder === ME ? "You" : b.bidder}</span>
                        {i === 0 && <Badge tone="brand">Leading</Badge>}
                      </div>
                      <div className="num font-medium">{usd(b.amount)}</div>
                    </div>
                  ))}
                </div>
              ) : <p className="text-sm text-muted-foreground">No bids yet. Be the first.</p>}
            </Section>
          )}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20 lg:h-fit">
          <div className="surface p-5">
            {isAuction ? (
              <>
                <div className="flex items-center justify-between">
                  <span className="eyebrow">{ended ? "Auction ended" : "Auction ends in"}</span>
                  {!ended && <Badge tone="live"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-live" />Live</Badge>}
                </div>
                <Countdown endsAt={l.endsAt} className="mt-1 block text-2xl font-semibold" />
                <div className="mt-5 eyebrow">Current bid · exclusive single copy</div>
                <div className="num text-4xl font-semibold tracking-tight">{usd(l.currentBid)}</div>
                <div className="mt-1 flex flex-wrap gap-x-3 text-sm text-muted-foreground">
                  <span>{l.bids.length} bids</span>
                  {l.reserve && <span className={(!l.reserve || l.currentBid >= l.reserve) ? "text-brand" : "text-warning"}>{(!l.reserve || l.currentBid >= l.reserve) ? "Reserve met" : "Reserve not met"}</span>}
                </div>
                {!ended && !mine && (
                  <Button size="lg" className="mt-4 w-full" onClick={() => setBidOpen(true)}>Place bid · min {usd(minNextBid(l.currentBid, l.bids.length > 0, l.startingBid))}</Button>
                )}
              </>
            ) : (
              <>
                <div className="eyebrow">Price</div>
                <div className="num text-4xl font-semibold tracking-tight">{usd(l.buyNow ?? l.currentBid)}</div>
                <div className={cn("mt-2 text-sm font-medium", soldOut ? "text-warning" : inv.mode === "limited" ? "text-brand" : "text-muted-foreground")}>
                  {soldOut ? "Sold out" : inv.mode === "limited" ? `${inv.remaining} of ${inv.total} remaining` : "Unlimited availability"}
                </div>
                {soldOut ? (
                  <Button size="lg" className="mt-4 w-full" disabled>Sold out</Button>
                ) : purchasable && (
                  <Button size="lg" className="mt-4 w-full" onClick={buy}><Download className="h-4 w-4" />Buy now · instant escrow</Button>
                )}
              </>
            )}
            {mine && <div className="mt-4 rounded-md bg-secondary px-3 py-2 text-sm">This is your listing.</div>}
            {deal && (
              <Link to="/deal/$id" params={{ id: deal.id }} className={buttonVariants({ variant: "brand", size: "lg", className: "mt-4 w-full" })}>
                Open deal room
              </Link>
            )}
            <Button variant="ghost" className="mt-2 w-full" onClick={() => actions.toggleWatch(l.id)}>
              <Heart className={cn("h-4 w-4", watched && "fill-current")} /> {watched ? "Watching" : "Add to watchlist"}
            </Button>
          </div>

          {isAuction && !ended && !mine && !deal && (
            <div className="rounded-xl border border-dashed border-warning bg-warning-soft p-4">
              <div className="text-sm font-semibold">Demo controls</div>
              <p className="mt-1 text-xs text-muted-foreground">Skip the wait: close this auction with you as the winning bidder (at or above reserve).</p>
              <Button variant="demo" className="mt-3 w-full" onClick={() => { const d = actions.winAuction(l.id); toast.success("You won the auction!", { description: "Your file is ready to download." }); goDeal(d); }}>
                <Trophy className="h-4 w-4" /> Demo: win auction
              </Button>
            </div>
          )}

          <SellerCard l={l} />
        </aside>
      </div>
      <BidDialog listing={l} open={bidOpen} onOpenChange={setBidOpen} />
    </div>
  );
}

function SellerCard({ l }: { l: ListingT }) {
  return (
    <div className="surface p-5">
      <div className="eyebrow">Seller</div>
      <div className="mt-3 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-secondary font-semibold">{l.seller.name.slice(0, 2)}</div>
        <div className="min-w-0">
          <div className="flex items-center gap-1 font-semibold">{l.seller.name}{l.seller.verified && <BadgeCheck className="h-4 w-4 text-brand" />}</div>
          <div className="text-sm text-muted-foreground">@{l.seller.handle}</div>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-3 border-t border-border pt-4 text-sm">
        <Stat label="Rating" value={<span className="inline-flex items-center gap-1">{l.seller.rating ? l.seller.rating.toFixed(1) : "—"}<Star className="h-3.5 w-3.5" /></span>} />
        <Stat label="Sales" value={l.seller.sales} />
        <Stat label="Since" value={l.seller.joined} />
      </div>
      <div className="mt-3 text-xs text-muted-foreground">Typically responds {l.seller.responseTime}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="surface p-5">
      <h2 className="mb-4 font-semibold">{title}</h2>
      {children}
    </section>
  );
}
