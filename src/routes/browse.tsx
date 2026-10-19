import { createFileRoute } from "@tanstack/react-router";
import { Search, SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";
import { ListingCard, isFullyVerified } from "@/components/sb/ListingCard";
import { Button, Empty, PageHeader } from "@/components/sb/ui";
import { useAppState } from "@/lib/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/browse")({
  head: () => ({
    meta: [
      { title: "Marketplace — bestottr" },
      { name: "description", content: "Search verified Roblox experiences for sale by price, revenue, genre and auction format." },
      { property: "og:title", content: "Marketplace — bestottr" },
      { property: "og:description", content: "Search verified Roblox experiences for sale." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Browse,
});

type Format = "all" | "auction" | "buy_now";
const DEFAULTS = { q: "", minPrice: "", maxPrice: "", minRev: "", genre: "all", format: "all" as Format, verified: false, watch: false, sort: "ending" };

function Browse() {
  const { listings, watchlist } = useAppState();
  const [f, setF] = useState(DEFAULTS);
  const [showFilters, setShowFilters] = useState(false);
  const up = <K extends keyof typeof DEFAULTS>(k: K, v: (typeof DEFAULTS)[K]) => setF((p) => ({ ...p, [k]: v }));
  const live = listings.filter((l) => l.status === "live");
  const genres = Array.from(new Set(live.map((l) => l.genre))).sort();

  const results = useMemo(() => {
    const price = (l: (typeof live)[number]) => (l.format === "auction" ? l.currentBid : (l.buyNow ?? l.currentBid));
    const r = live.filter((l) => {
      if (f.q && !`${l.title} ${l.genre} ${l.tagline} ${l.seller.name}`.toLowerCase().includes(f.q.toLowerCase())) return false;
      if (f.minPrice && price(l) < Number(f.minPrice)) return false;
      if (f.maxPrice && price(l) > Number(f.maxPrice)) return false;
      if (f.minRev && l.monthlyRevenue < Number(f.minRev)) return false;
      if (f.genre !== "all" && l.genre !== f.genre) return false;
      if (f.format !== "all" && l.format !== f.format) return false;
      if (f.verified && !isFullyVerified(l)) return false;
      if (f.watch && !watchlist.includes(l.id)) return false;
      return true;
    });
    const sorters: Record<string, (a: (typeof r)[number], b: (typeof r)[number]) => number> = {
      ending: (a, b) => a.endsAt - b.endsAt,
      priceAsc: (a, b) => price(a) - price(b),
      priceDesc: (a, b) => price(b) - price(a),
      revenue: (a, b) => b.monthlyRevenue - a.monthlyRevenue,
      ccu: (a, b) => b.ccu - a.ccu,
      newest: (a, b) => b.createdAt - a.createdAt,
    };
    return [...r].sort(sorters[f.sort]);
  }, [live, f, watchlist]);

  const activeCount = Object.entries(f).filter(([k, v]) => k !== "sort" && k !== "q" && v !== DEFAULTS[k as keyof typeof DEFAULTS]).length;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 md:px-6">
      <PageHeader title="Marketplace" subtitle={`${live.length} live listings · verified metrics from Roblox analytics`} />

      <div className="mt-6 flex flex-wrap gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input className="field pl-9" placeholder="Search experiences, genres, studios…" value={f.q} onChange={(e) => up("q", e.target.value)} />
        </div>
        <select className="field w-auto" value={f.sort} onChange={(e) => up("sort", e.target.value)} aria-label="Sort">
          <option value="ending">Ending soonest</option>
          <option value="newest">Newest</option>
          <option value="priceAsc">Price: low to high</option>
          <option value="priceDesc">Price: high to low</option>
          <option value="revenue">Highest revenue</option>
          <option value="ccu">Highest CCU</option>
        </select>
        <Button variant="outline" className="lg:hidden" onClick={() => setShowFilters((s) => !s)}>
          <SlidersHorizontal className="h-4 w-4" /> Filters {activeCount > 0 && `(${activeCount})`}
        </Button>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[260px_1fr]">
        <aside className={cn("surface h-fit space-y-5 p-5 lg:sticky lg:top-20 lg:block", !showFilters && "hidden")}>
          <div>
            <div className="eyebrow mb-2">Format</div>
            <div className="grid grid-cols-3 gap-1 rounded-md bg-secondary p-1">
              {(["all", "auction", "buy_now"] as Format[]).map((v) => (
                <button key={v} onClick={() => up("format", v)} className={cn("rounded px-2 py-2 text-xs font-medium", f.format === v ? "bg-card shadow-sm" : "text-muted-foreground")}>
                  {v === "all" ? "All" : v === "auction" ? "Auction" : "Buy now"}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="eyebrow mb-2">Price (USD)</div>
            <div className="flex gap-2">
              <input className="field num" inputMode="numeric" placeholder="Min" value={f.minPrice} onChange={(e) => up("minPrice", e.target.value.replace(/\D/g, ""))} />
              <input className="field num" inputMode="numeric" placeholder="Max" value={f.maxPrice} onChange={(e) => up("maxPrice", e.target.value.replace(/\D/g, ""))} />
            </div>
          </div>
          <div>
            <div className="eyebrow mb-2">Min. monthly revenue</div>
            <select className="field" value={f.minRev} onChange={(e) => up("minRev", e.target.value)}>
              <option value="">Any</option>
              <option value="2000">$2k+</option>
              <option value="5000">$5k+</option>
              <option value="10000">$10k+</option>
              <option value="25000">$25k+</option>
            </select>
          </div>
          <div>
            <div className="eyebrow mb-2">Genre</div>
            <select className="field" value={f.genre} onChange={(e) => up("genre", e.target.value)}>
              <option value="all">All genres</option>
              {genres.map((g) => <option key={g}>{g}</option>)}
            </select>
          </div>
          <Toggle label="Fully verified only" checked={f.verified} onChange={(v) => up("verified", v)} />
          <Toggle label="Watchlist only" checked={f.watch} onChange={(v) => up("watch", v)} />
          <Button variant="ghost" size="sm" className="w-full" onClick={() => setF({ ...DEFAULTS, q: f.q, sort: f.sort })}>Clear filters</Button>
        </aside>

        <div>
          <div className="mb-3 text-sm text-muted-foreground">{results.length} results</div>
          {results.length ? (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {results.map((l) => <ListingCard key={l.id} listing={l} />)}
            </div>
          ) : (
            <Empty title="No listings match" body="Try widening your price range or clearing filters." action={<Button variant="outline" onClick={() => setF(DEFAULTS)}>Reset filters</Button>} />
          )}
        </div>
      </div>
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!checked)} className="flex w-full items-center justify-between text-sm" role="switch" aria-checked={checked}>
      {label}
      <span className={cn("relative h-6 w-10 rounded-full transition-colors", checked ? "bg-brand" : "bg-input")}>
        <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-card shadow transition-all", checked ? "left-[18px]" : "left-0.5")} />
      </span>
    </button>
  );
}
