import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { BadgeCheck, Check } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button, PageHeader } from "@/components/sb/ui";
import { ME, ME_NAME, type Listing } from "@/lib/data";
import { usd } from "@/lib/format";
import { img } from "@/lib/images";
import { actions, useAppState } from "@/lib/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/sell")({
  head: () => ({
    meta: [
      { title: "Sell your experience — StudioBid" },
      { name: "description", content: "Verify your Roblox experience and list it for auction or buy-now." },
      { property: "og:title", content: "Sell your experience — StudioBid" },
      { property: "og:description", content: "List a verified Roblox experience." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Sell,
});

const STEPS = ["Roblox verification", "Experience", "Details", "Financials", "Sale format", "Assets", "Review"];
const OWNED = [
  { id: "x1", title: "Sky Kingdom Builders", genre: "Simulator", image: "g6", rev: 2600, profit: 2300, visits: 840000, ccu: 380 },
  { id: "x2", title: "Midnight Courier", genre: "Horror", image: "g2", rev: 1800, profit: 1650, visits: 610000, ccu: 240 },
  { id: "x3", title: "Rail Rush Tycoon", genre: "Tycoon", image: "g1", rev: 4100, profit: 3700, visits: 1300000, ccu: 690 },
];
const ASSETS = ["Experience & all places", "Full source code", "Private packages", "Roblox group", "Game icon & thumbnails", "Discord server", "Social accounts", "Analytics dashboards"];

function Sell() {
  const s = useAppState();
  const nav = useNavigate();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [exp, setExp] = useState<(typeof OWNED)[number] | null>(null);
  const [d, setD] = useState({ title: "", tagline: "", description: "", rev: 0, profit: 0, format: "auction" as "auction" | "buy_now", start: 10000, reserve: 15000, buyNow: 25000, days: 7, assets: ASSETS.slice(0, 5) });
  const up = (p: Partial<typeof d>) => setD((x) => ({ ...x, ...p }));
  const canNext = [s.roblox.connected, !!exp, d.title.length > 2, d.rev > 0, d.start > 0, d.assets.length > 0, true][step];

  function publish() {
    const id = `new-${Date.now()}`;
    const l: Listing = {
      id, title: d.title, tagline: d.tagline, description: d.description, genre: exp!.genre, image: exp!.image, format: d.format,
      startingBid: d.format === "auction" ? d.start : d.buyNow, currentBid: d.format === "auction" ? d.start : d.buyNow,
      reserve: d.format === "auction" ? d.reserve : undefined, buyNow: d.buyNow, endsAt: Date.now() + d.days * 86400000, bids: [], status: "review",
      monthlyRevenue: d.rev, monthlyProfit: d.profit, monthlyVisits: exp!.visits, ccu: exp!.ccu, favorites: 12000, ageMonths: 10,
      monetization: [{ label: "Game passes", pct: 60 }, { label: "Developer products", pct: 40 }],
      seller: { handle: ME, name: ME_NAME, rating: 4.9, sales: 2, joined: "2020", verified: true, responseTime: "< 1h" },
      assets: d.assets, risks: [], verified: { ownership: true, revenue: true, traffic: true }, hasGroup: d.assets.includes("Roblox group"), createdAt: Date.now(),
    };
    actions.publishListing(l);
    toast.success("Listing submitted for review", { description: "Approve it from the Admin console to go live." });
    nav({ to: "/seller" });
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 md:px-6">
      <PageHeader title="Create a listing" subtitle={`Step ${step + 1} of ${STEPS.length} · ${STEPS[step]}`} />
      <ol className="mt-6 flex gap-1 overflow-x-auto">
        {STEPS.map((st, i) => <li key={st} className={cn("h-1.5 min-w-8 flex-1 rounded-full", i <= step ? "bg-foreground" : "bg-secondary")} />)}
      </ol>
      <div className="surface mt-6 p-6">
        {step === 0 && (s.roblox.connected ? (
          <div className="flex items-center gap-3 text-brand"><BadgeCheck className="h-6 w-6" /><div><div className="font-semibold">Connected as @{s.roblox.username}</div><div className="text-sm text-muted-foreground">Ownership of your experiences is verified.</div></div></div>
        ) : (
          <div><p className="text-sm text-muted-foreground">Connect your Roblox account so we can verify ownership and pull analytics. (Demo — no credentials needed.)</p>
            <Button className="mt-4" disabled={busy} onClick={() => { setBusy(true); setTimeout(() => { actions.connectRoblox(); setBusy(false); }, 900); }}>{busy ? "Verifying…" : "Connect Roblox (demo)"}</Button></div>
        ))}
        {step === 1 && <div className="grid gap-3 sm:grid-cols-3">{OWNED.map((o) => (
          <button key={o.id} onClick={() => { setExp(o); up({ title: o.title, rev: o.rev, profit: o.profit }); }} className={cn("overflow-hidden rounded-lg border text-left", exp?.id === o.id ? "border-foreground ring-2 ring-ring" : "border-border")}>
            <img src={img(o.image)} alt="" className="aspect-video w-full object-cover" /><div className="p-3"><div className="text-sm font-medium">{o.title}</div><div className="text-xs text-muted-foreground">{o.genre} · {o.ccu} CCU</div></div>
          </button>))}</div>}
        {step === 2 && <div className="space-y-4">
          <F label="Title"><input className="field" value={d.title} onChange={(e) => up({ title: e.target.value })} /></F>
          <F label="Tagline"><input className="field" value={d.tagline} onChange={(e) => up({ tagline: e.target.value })} /></F>
          <F label="Description"><textarea className="field h-28 py-2" value={d.description} onChange={(e) => up({ description: e.target.value })} /></F>
        </div>}
        {step === 3 && <div className="grid gap-4 sm:grid-cols-2">
          <p className="text-sm text-brand sm:col-span-2">Pre-filled from verified Roblox analytics.</p>
          <F label="Monthly revenue (USD)"><input className="field num" inputMode="numeric" value={d.rev} onChange={(e) => up({ rev: Number(e.target.value.replace(/\D/g, "")) })} /></F>
          <F label="Monthly profit (USD)"><input className="field num" inputMode="numeric" value={d.profit} onChange={(e) => up({ profit: Number(e.target.value.replace(/\D/g, "")) })} /></F>
        </div>}
        {step === 4 && <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">{(["auction", "buy_now"] as const).map((f) => <Button key={f} variant={d.format === f ? "primary" : "outline"} onClick={() => up({ format: f })}>{f === "auction" ? "Auction" : "Buy now"}</Button>)}</div>
          <div className="grid gap-4 sm:grid-cols-2">
            {d.format === "auction" && <><F label="Starting bid"><input className="field num" value={d.start} onChange={(e) => up({ start: Number(e.target.value.replace(/\D/g, "")) })} /></F>
            <F label="Reserve"><input className="field num" value={d.reserve} onChange={(e) => up({ reserve: Number(e.target.value.replace(/\D/g, "")) })} /></F>
            <F label="Duration (days)"><select className="field" value={d.days} onChange={(e) => up({ days: Number(e.target.value) })}>{[3, 5, 7, 10].map((n) => <option key={n} value={n}>{n}</option>)}</select></F></>}
            <F label="Buy-now price"><input className="field num" value={d.buyNow} onChange={(e) => up({ buyNow: Number(e.target.value.replace(/\D/g, "")) })} /></F>
          </div>
        </div>}
        {step === 5 && <div className="grid gap-2 sm:grid-cols-2">{ASSETS.map((a) => {
          const on = d.assets.includes(a);
          return <button key={a} onClick={() => up({ assets: on ? d.assets.filter((x) => x !== a) : [...d.assets, a] })} className="flex items-center gap-3 rounded-md border border-border p-3 text-left text-sm">
            <span className={cn("flex h-5 w-5 items-center justify-center rounded border", on ? "border-brand bg-brand text-brand-foreground" : "border-input")}>{on && <Check className="h-3.5 w-3.5" />}</span>{a}</button>;
        })}</div>}
        {step === 6 && exp && <div className="space-y-2 text-sm">
          <div className="text-lg font-semibold">{d.title}</div><div className="text-muted-foreground">{d.tagline}</div>
          <div className="num">Revenue {usd(d.rev)}/mo · Profit {usd(d.profit)}/mo</div>
          <div className="num">{d.format === "auction" ? `Auction from ${usd(d.start)}, reserve ${usd(d.reserve)}, ${d.days} days` : "Buy now"} · Buy-now {usd(d.buyNow)}</div>
          <div>{d.assets.join(", ")}</div>
        </div>}
        <div className="mt-8 flex justify-between border-t border-border pt-4">
          <Button variant="outline" disabled={step === 0} onClick={() => setStep(step - 1)}>Back</Button>
          {step < 6 ? <Button disabled={!canNext} onClick={() => setStep(step + 1)}>Continue</Button> : <Button variant="brand" onClick={publish}>Publish listing</Button>}
        </div>
      </div>
    </div>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-sm font-medium">{label}</span>{children}</label>;
}
