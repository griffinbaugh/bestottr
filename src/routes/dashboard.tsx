import { IS_DEMO } from "@/lib/app-mode";
import { AccountOrdersDashboard } from "@/components/account/AccountOrdersDashboard";
import { MarketplaceGate } from "@/components/account/MarketplaceGate";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ListingCard } from "@/components/sb/ListingCard";
import { Badge, Empty, PageHeader, Tabs, buttonVariants } from "@/components/sb/ui";
import { ME } from "@/lib/data";
import { dealStatus } from "@/lib/deal-status";
import { usd } from "@/lib/format";
import { useAppState } from "@/lib/store";

type Tab = "bids" | "won" | "watchlist" | "transactions";
export const Route = createFileRoute("/dashboard")({
  validateSearch: (s: Record<string, unknown>): { tab?: Tab } => ({ tab: (s["tab"] as Tab) || undefined }),
  head: () => ({
    meta: [
      { name: "robots", content: "noindex" },
      { title: "Buyer dashboard — bestottr" },
      { name: "description", content: "Your active bids, won auctions, watchlist and transactions." },
      { property: "og:title", content: "Buyer dashboard — bestottr" },
      { property: "og:description", content: "Track bids and acquisitions." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => IS_DEMO ? <MarketplaceGate><Buyer /></MarketplaceGate> : <AccountOrdersDashboard side="buying"/>,
});

function Buyer() {
  const s = useAppState();
  const tab = Route.useSearch().tab ?? "bids";
  const navigate = Route.useNavigate();
  const bidOn = s.listings.filter((l) => l.status === "live" && l.bids.some((b) => b.bidder === ME));
  const deals = s.deals.filter((d) => d.buyer === ME);
  const watch = s.listings.filter((l) => s.watchlist.includes(l.id));
  const title = (id: string) => s.listings.find((l) => l.id === id)?.title ?? id;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 md:px-6">
      <PageHeader title="Buying" subtitle="Bids, wins and acquisitions" actions={<Link to="/browse" search={{ q: "" }} className={buttonVariants()}>Browse listings</Link>} />
      <div className="mt-6">
        <Tabs value={tab} onChange={(t) => navigate({ search: { tab: t } })} items={[
          { value: "bids", label: "Active bids", count: bidOn.length },
          { value: "won", label: "Won auctions", count: deals.length },
          { value: "watchlist", label: "Watchlist", count: watch.length },
          { value: "transactions", label: "Transactions", count: deals.length },
        ]} />
      </div>
      <div className="mt-6">
        {tab === "bids" && (bidOn.length ? (
          <div className="grid gap-3">{bidOn.map((l) => (
            <Link key={l.id} to="/listing/$id" params={{ id: l.id }} className="surface lift flex items-center justify-between p-4">
              <div><div className="font-medium">{l.title}</div><div className="num text-sm text-muted-foreground">Current {usd(l.currentBid)}</div></div>
              {l.bids[0]?.bidder === ME ? <Badge tone="brand">Winning</Badge> : <Badge tone="live">Outbid</Badge>}
            </Link>))}</div>
        ) : <Empty title="No active bids" body="Place a bid on any live auction." action={<Link to="/listing/$id" params={{ id: "factory-tycoon" }} className={buttonVariants({ variant: "outline" })}>Try Factory Tycoon</Link>} />)}
        {tab === "watchlist" && (watch.length ? <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{watch.map((l) => <ListingCard key={l.id} listing={l} />)}</div> : <Empty title="Watchlist is empty" body="Tap the heart on any listing." />)}
        {(tab === "won" || tab === "transactions") && (deals.length ? (
          <div className="grid gap-3">{deals.map((d) => (
            <Link key={d.id} to="/deal/$id" params={{ id: d.id }} className="surface lift flex items-center justify-between p-4">
              <div><div className="font-medium">{title(d.listingId)}</div><div className="num text-sm text-muted-foreground">#{d.id} · {usd(d.price)} · {d.kind === "file" ? "File purchase" : d.kind === "community" ? "Community transfer" : "Experience transfer"}</div></div>
              <Badge tone={dealStatus(d).tone}>{d.kind === "file" ? "Available · Download" : dealStatus(d).label}</Badge>
            </Link>))}</div>
        ) : <Empty title="No acquisitions yet" body="Win an auction or buy now to open a deal room." />)}
      </div>
    </div>
  );
}
