import { Link } from "@tanstack/react-router";
import mark from "@/assets/mark-white.png";
import { BadgeCheck, Heart, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { actions, useAppState } from "@/lib/store";

const nav = [
  { to: "/browse", label: "Marketplace" },
  { to: "/sell", label: "Sell" },
  { to: "/dashboard", label: "Buying" },
  { to: "/seller", label: "Selling" },
  { to: "/admin", label: "Admin" },
] as const;

export function SiteHeader() {
  const s = useAppState();
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 md:px-6">
        <Link to="/" className="flex items-center gap-2.5 font-semibold tracking-tight" aria-label="bestottr home">
          <img src={mark} alt="" width={28} height={28} className="h-7 w-7" />
          <span className="text-[17px]">bestottr</span>
        </Link>
        <nav className="hidden items-center gap-1 md:flex">
          {nav.map((n) => (
            <Link key={n.to} to={n.to} className="rounded-md px-3 py-2 text-sm text-muted-foreground hover:text-foreground" activeProps={{ className: "text-foreground bg-secondary" }}>
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-1">
          <Link to="/dashboard" search={{ tab: "watchlist" }} className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground" aria-label="Watchlist">
            <Heart className="h-4 w-4" />
          </Link>
          {s.roblox.connected && (
            <span className="hidden items-center gap-1 rounded-full bg-brand-soft px-2.5 py-1 text-xs font-medium text-brand sm:inline-flex">
              <BadgeCheck className="h-3.5 w-3.5" /> @{s.roblox.username}
            </span>
          )}
          <button
            onClick={() => {
              actions.reset();
              toast("Demo data reset");
            }}
            className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="Reset demo data"
            title="Reset demo data"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
          <div className="ml-1 flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-xs font-semibold">AR</div>
        </div>
      </div>
      <nav className="flex gap-1 overflow-x-auto border-t border-border px-3 py-1.5 md:hidden">
        {nav.map((n) => (
          <Link key={n.to} to={n.to} className="shrink-0 rounded-md px-3 py-2 text-sm text-muted-foreground" activeProps={{ className: "text-foreground bg-secondary" }}>
            {n.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
