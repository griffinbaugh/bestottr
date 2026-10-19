import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { BadgeCheck, Building2, Check, FileUp, Link2, ShieldX, Upload } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button, PageHeader } from "@/components/sb/ui";
import { FILE_CATEGORIES, ME, ME_NAME, type FileCategory, type FileMeta, type Listing } from "@/lib/data";
import { usd } from "@/lib/format";
import { img } from "@/lib/images";
import { DEMO_URLS, VERIFY_ERRORS, verifyOwnership, type VerifiedExperience, type VerifyFailure } from "@/lib/roblox";
import { actions, useAppState } from "@/lib/store";
import { cn } from "@/lib/utils";
import mark from "@/assets/mark-white.png";

export const Route = createFileRoute("/sell")({
  head: () => ({
    meta: [
      { title: "Create a listing — bestottr" },
      { name: "description", content: "List a verified Roblox experience or a creator file for auction or buy-now." },
      { property: "og:title", content: "Create a listing — bestottr" },
      { property: "og:description", content: "List a verified Roblox experience or a creator file." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Sell,
});

const EXP_STEPS = ["Listing type", "Connect Roblox", "Experience link", "Details", "Financials", "Sale format", "Assets", "Review"];
const FILE_STEPS = ["Listing type", "File upload", "Details", "Sale setup", "License & rights", "Review"];
const ASSETS = ["Experience & all places", "Full source code", "Private packages", "Roblox group", "Game icon & thumbnails", "Discord server", "Social accounts", "Analytics dashboards"];
const DEMO_FILES = [
  { fileName: "combat-system_v2.0.rbxm", fileType: ".rbxm", fileSize: "3.2 MB" },
  { fileName: "ui-pack_v1.4.rbxm", fileType: ".rbxm", fileSize: "5.8 MB" },
  { fileName: "asset-bundle_v3.1.zip", fileType: ".zip", fileSize: "64 MB" },
];
const PREVIEWS = ["f1", "f2", "f3", "f4", "f5", "f6"];
const meSeller = { handle: ME, name: ME_NAME, rating: 4.9, sales: 2, joined: "2020", verified: true, responseTime: "< 1h" };

function Sell() {
  const s = useAppState();
  const nav = useNavigate();
  const [kind, setKind] = useState<"experience" | "file" | null>(null);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [url, setUrl] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState<{ exp: VerifiedExperience; via?: string } | null>(null);
  const [verr, setVerr] = useState<VerifyFailure | null>(null);
  const [d, setD] = useState({ title: "", tagline: "", description: "", rev: 0, profit: 0, format: "auction" as "auction" | "buy_now", start: 10000, reserve: 15000, buyNow: 25000, days: 7, assets: ASSETS.slice(0, 5) });
  const up = (p: Partial<typeof d>) => setD((x) => ({ ...x, ...p }));

  // File listing state
  const [fd, setFd] = useState({
    title: "", tagline: "", description: "", category: "Scripts" as FileCategory,
    version: "1.0.0", compatibility: "", includedFiles: "", license: "", sellerNotes: "",
    format: "buy_now" as "auction" | "buy_now", start: 100, reserve: 250, buyNow: 99, days: 7,
    invMode: "unlimited" as "unlimited" | "limited", quantity: 10, image: "f1", attested: false,
  });
  const [file, setFile] = useState<(typeof DEMO_FILES)[number] | null>(null);
  const [uploading, setUploading] = useState(false);
  const fup = (p: Partial<typeof fd>) => setFd((x) => ({ ...x, ...p }));

  const steps = kind === "file" ? FILE_STEPS : EXP_STEPS;

  const expCanNext = [kind !== null, s.roblox.connected, !!verified, d.title.length > 2, d.rev > 0, d.start > 0, d.assets.length > 0, true][step];
  const fileCanNext = [kind !== null, !!file, fd.title.length > 2 && fd.compatibility.length > 2, fd.format === "auction" ? fd.start > 0 : fd.buyNow > 0, fd.license.length > 5 && fd.attested, true][step];
  const canNext = kind === "file" ? fileCanNext : expCanNext;

  function pickType(k: "experience" | "file") {
    setKind(k);
    setStep(1);
  }

  function mockUpload(f: (typeof DEMO_FILES)[number]) {
    setUploading(true);
    setTimeout(() => {
      setFile(f);
      setUploading(false);
      if (!fd.title) fup({ title: f.fileName.replace(/\.(rbxm|zip)$/, "").replace(/[_-]/g, " ").replace(/\bv\d.*$/, "").trim() });
    }, 900);
  }

  function runVerify() {
    setVerifying(true);
    setVerr(null);
    setVerified(null);
    // Simulated network latency — the real implementation will call the Roblox API here.
    setTimeout(() => {
      const r = verifyOwnership(url, s.roblox);
      if (r.ok) {
        setVerified({ exp: r.exp, via: r.via });
        up({ title: r.exp.title, rev: r.exp.monthlyRevenue, profit: r.exp.monthlyProfit });
      } else {
        setVerr(r.reason);
      }
      setVerifying(false);
    }, 900);
  }

  function disconnect() {
    actions.disconnectRoblox();
    setVerified(null);
    setVerr(null);
    setUrl("");
  }

  function publishExperience() {
    const id = `new-${Date.now()}`;
    const exp = verified!.exp;
    const l: Listing = {
      id, kind: "experience", title: d.title, tagline: d.tagline, description: d.description, genre: exp.genre, image: exp.image, format: d.format,
      startingBid: d.format === "auction" ? d.start : d.buyNow, currentBid: d.format === "auction" ? d.start : d.buyNow,
      reserve: d.format === "auction" ? d.reserve : undefined, buyNow: d.buyNow, endsAt: Date.now() + d.days * 86400000, bids: [], status: "review",
      monthlyRevenue: d.rev, monthlyProfit: d.profit, monthlyVisits: exp.monthlyVisits, ccu: exp.ccu, favorites: 12000, ageMonths: 10,
      monetization: [{ label: "Game passes", pct: 60 }, { label: "Developer products", pct: 40 }],
      seller: meSeller,
      assets: d.assets, risks: [], verified: { ownership: true, revenue: true, traffic: true }, hasGroup: d.assets.includes("Roblox group"), createdAt: Date.now(),
    };
    actions.publishListing(l);
    toast.success("Listing submitted for review", { description: "Approve it from the Admin console to go live." });
    nav({ to: "/seller" });
  }

  function publishFile() {
    const id = `new-${Date.now()}`;
    const meta: FileMeta = {
      fileName: file!.fileName, fileType: file!.fileType, fileSize: file!.fileSize,
      version: fd.version, category: fd.category, compatibility: fd.compatibility,
      includedFiles: fd.includedFiles.split("\n").map((x) => x.trim()).filter(Boolean),
      license: fd.license, sellerNotes: fd.sellerNotes,
      inventory: fd.format === "auction" ? { mode: "limited", total: 1, remaining: 1 } : fd.invMode === "unlimited" ? { mode: "unlimited" } : { mode: "limited", total: fd.quantity, remaining: fd.quantity },
    };
    const l: Listing = {
      id, kind: "file", title: fd.title, tagline: fd.tagline, description: fd.description, genre: fd.category, image: fd.image, format: fd.format,
      startingBid: fd.format === "auction" ? fd.start : fd.buyNow, currentBid: fd.format === "auction" ? fd.start : fd.buyNow,
      reserve: fd.format === "auction" ? fd.reserve : undefined, buyNow: fd.format === "buy_now" ? fd.buyNow : undefined,
      endsAt: Date.now() + fd.days * 86400000, bids: [], status: "review",
      monthlyRevenue: 0, monthlyProfit: 0, monthlyVisits: 0, ccu: 0, favorites: 0, ageMonths: 0,
      monetization: [], seller: meSeller, assets: meta.includedFiles, risks: [],
      verified: { ownership: true, revenue: false, traffic: false }, hasGroup: false, createdAt: Date.now(), file: meta,
    };
    actions.publishListing(l);
    toast.success("File listing submitted for review", { description: "Approve it from the Admin console to go live." });
    nav({ to: "/seller" });
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 md:px-6">
      <PageHeader title="Create a listing" subtitle={`Step ${step + 1} of ${steps.length} · ${steps[step]}`} />
      <ol className="mt-6 flex gap-1 overflow-x-auto">
        {steps.map((st, i) => <li key={st} className={cn("h-1.5 min-w-8 flex-1 rounded-full", i <= step ? "bg-foreground" : "bg-secondary")} />)}
      </ol>
      <div className="surface mt-6 p-6">
        {step === 0 && (
          <div className="grid gap-3 sm:grid-cols-2">
            <button onClick={() => pickType("experience")} className="rounded-lg border border-border p-5 text-left hover:border-foreground">
              <Building2 className="h-6 w-6 text-muted-foreground" />
              <div className="mt-3 font-semibold">Experience / business</div>
              <p className="mt-1 text-sm text-muted-foreground">Sell a whole Roblox experience or studio. Verified metrics, auction or buy-now, managed ownership transfer.</p>
            </button>
            <button onClick={() => pickType("file")} className="rounded-lg border border-border p-5 text-left hover:border-foreground">
              <FileUp className="h-6 w-6 text-muted-foreground" />
              <div className="mt-3 font-semibold">File / digital asset</div>
              <p className="mt-1 text-sm text-muted-foreground">Sell scripts, systems, models, UI kits, maps, audio and more. Instant delivery with escrow protection.</p>
            </button>
          </div>
        )}

        {/* ---- Experience flow ---- */}
        {kind === "experience" && step === 1 && (s.roblox.connected ? (
          <div className="flex items-center gap-3 text-brand"><BadgeCheck className="h-6 w-6" /><div><div className="font-semibold">Connected as @{s.roblox.username}</div><div className="text-sm text-muted-foreground">Ownership of your experiences is verified.</div></div></div>
        ) : (
          <div><img src={mark} alt="" width={40} height={40} loading="lazy" className="mb-3 h-10 w-10" /><p className="text-sm text-muted-foreground">Connect your Roblox account so we can verify ownership and pull analytics. (Demo — no credentials needed.)</p>
            <Button className="mt-4" disabled={busy} onClick={() => { setBusy(true); setTimeout(() => { actions.connectRoblox(); setBusy(false); }, 900); }}>{busy ? "Verifying…" : "Connect Roblox (demo)"}</Button></div>
        ))}
        {kind === "experience" && step === 2 && <div className="grid gap-3 sm:grid-cols-3">{OWNED.map((o) => (
          <button key={o.id} onClick={() => { setExp(o); up({ title: o.title, rev: o.rev, profit: o.profit }); }} className={cn("overflow-hidden rounded-lg border text-left", exp?.id === o.id ? "border-foreground ring-2 ring-ring" : "border-border")}>
            <img src={img(o.image)} alt="" className="aspect-video w-full object-cover" /><div className="p-3"><div className="text-sm font-medium">{o.title}</div><div className="text-xs text-muted-foreground">{o.genre} · {o.ccu} CCU</div></div>
          </button>))}</div>}
        {kind === "experience" && step === 3 && <div className="space-y-4">
          <F label="Title"><input className="field" value={d.title} onChange={(e) => up({ title: e.target.value })} /></F>
          <F label="Tagline"><input className="field" value={d.tagline} onChange={(e) => up({ tagline: e.target.value })} /></F>
          <F label="Description"><textarea className="field h-28 py-2" value={d.description} onChange={(e) => up({ description: e.target.value })} /></F>
        </div>}
        {kind === "experience" && step === 4 && <div className="grid gap-4 sm:grid-cols-2">
          <p className="text-sm text-brand sm:col-span-2">Pre-filled from verified Roblox analytics.</p>
          <F label="Monthly revenue (USD)"><input className="field num" inputMode="numeric" value={d.rev} onChange={(e) => up({ rev: Number(e.target.value.replace(/\D/g, "")) })} /></F>
          <F label="Monthly profit (USD)"><input className="field num" inputMode="numeric" value={d.profit} onChange={(e) => up({ profit: Number(e.target.value.replace(/\D/g, "")) })} /></F>
        </div>}
        {kind === "experience" && step === 5 && <SaleFormat d={d} up={up} showInventory={false} />}
        {kind === "experience" && step === 6 && <div className="grid gap-2 sm:grid-cols-2">{ASSETS.map((a) => {
          const on = d.assets.includes(a);
          return <button key={a} onClick={() => up({ assets: on ? d.assets.filter((x) => x !== a) : [...d.assets, a] })} className="flex items-center gap-3 rounded-md border border-border p-3 text-left text-sm">
            <span className={cn("flex h-5 w-5 items-center justify-center rounded border", on ? "border-brand bg-brand text-brand-foreground" : "border-input")}>{on && <Check className="h-3.5 w-3.5" />}</span>{a}</button>;
        })}</div>}
        {kind === "experience" && step === 7 && exp && <div className="space-y-2 text-sm">
          <div className="text-lg font-semibold">{d.title}</div><div className="text-muted-foreground">{d.tagline}</div>
          <div className="num">Revenue {usd(d.rev)}/mo · Profit {usd(d.profit)}/mo</div>
          <div className="num">{d.format === "auction" ? `Auction from ${usd(d.start)}, reserve ${usd(d.reserve)}, ${d.days} days` : "Buy now"} · Buy-now {usd(d.buyNow)}</div>
          <div>{d.assets.join(", ")}</div>
        </div>}

        {/* ---- File flow ---- */}
        {kind === "file" && step === 1 && (
          <div>
            <p className="text-sm text-muted-foreground">Upload the file buyers will receive. <span className="text-warning">Demo prototype — uploads are simulated and no real file is stored.</span></p>
            {file ? (
              <div className="mt-4 flex items-center justify-between rounded-md border border-brand bg-brand-soft p-3 text-sm">
                <span className="flex items-center gap-2"><FileUp className="h-4 w-4 text-brand" />{file.fileName} <span className="text-xs text-muted-foreground">({file.fileSize})</span></span>
                <BadgeCheck className="h-4 w-4 text-brand" />
              </div>
            ) : (
              <div className="mt-4 space-y-2">
                {DEMO_FILES.map((f) => (
                  <button key={f.fileName} disabled={uploading} onClick={() => mockUpload(f)} className="flex w-full items-center gap-3 rounded-md border border-dashed border-input p-3 text-left text-sm hover:border-foreground disabled:opacity-50">
                    <Upload className="h-4 w-4 text-muted-foreground" />
                    <span>{f.fileName}</span>
                    <span className="ml-auto text-xs text-muted-foreground">{f.fileSize}</span>
                  </button>
                ))}
                {uploading && <p className="text-xs text-muted-foreground">Uploading… (demo)</p>}
              </div>
            )}
            <div className="mt-5">
              <div className="eyebrow mb-2">Preview image</div>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                {PREVIEWS.map((p) => (
                  <button key={p} onClick={() => fup({ image: p })} className={cn("overflow-hidden rounded-md border", fd.image === p ? "border-foreground ring-2 ring-ring" : "border-border")}>
                    <img src={img(p)} alt="" className="aspect-video w-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
        {kind === "file" && step === 2 && <div className="space-y-4">
          <F label="Display title"><input className="field" value={fd.title} onChange={(e) => fup({ title: e.target.value })} /></F>
          <F label="Tagline"><input className="field" value={fd.tagline} onChange={(e) => fup({ tagline: e.target.value })} /></F>
          <F label="Description"><textarea className="field h-28 py-2" value={fd.description} onChange={(e) => fup({ description: e.target.value })} /></F>
          <div className="grid gap-4 sm:grid-cols-3">
            <F label="Category"><select className="field" value={fd.category} onChange={(e) => fup({ category: e.target.value as FileCategory })}>{FILE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></F>
            <F label="Version"><input className="field num" value={fd.version} onChange={(e) => fup({ version: e.target.value })} /></F>
            <F label="Compatibility / requirements"><input className="field" placeholder="Roblox Studio 2024+, R15…" value={fd.compatibility} onChange={(e) => fup({ compatibility: e.target.value })} /></F>
          </div>
          <F label="Included files (one per line)"><textarea className="field h-24 py-2 font-mono text-xs" placeholder={"main.rbxm\nREADME.md\nSetup guide"} value={fd.includedFiles} onChange={(e) => fup({ includedFiles: e.target.value })} /></F>
        </div>}
        {kind === "file" && step === 3 && (
          <div className="space-y-4">
            <SaleFormat d={fd} up={(p) => fup(p)} showInventory />
            {fd.format === "buy_now" && (
              <div>
                <div className="eyebrow mb-2">Inventory</div>
                <div className="grid grid-cols-2 gap-2">
                  {(["unlimited", "limited"] as const).map((m) => (
                    <Button key={m} variant={fd.invMode === m ? "primary" : "outline"} onClick={() => fup({ invMode: m })}>{m === "unlimited" ? "Unlimited sales" : "Limited quantity"}</Button>
                  ))}
                </div>
                {fd.invMode === "limited" && (
                  <F label="Number of copies / licenses"><input className="field num mt-3" inputMode="numeric" value={fd.quantity} onChange={(e) => fup({ quantity: Math.max(1, Number(e.target.value.replace(/\D/g, "")) || 1) })} /></F>
                )}
                <p className="mt-2 text-xs text-muted-foreground">Auction file listings are always a single exclusive copy.</p>
              </div>
            )}
          </div>
        )}
        {kind === "file" && step === 4 && <div className="space-y-4">
          <F label="License / usage terms"><textarea className="field h-28 py-2" placeholder="What buyers may and may not do with this file…" value={fd.license} onChange={(e) => fup({ license: e.target.value })} /></F>
          <F label="Seller notes (optional)"><textarea className="field h-20 py-2" value={fd.sellerNotes} onChange={(e) => fup({ sellerNotes: e.target.value })} /></F>
          <button onClick={() => fup({ attested: !fd.attested })} className="flex items-start gap-3 rounded-md border border-border p-3 text-left text-sm" role="checkbox" aria-checked={fd.attested}>
            <span className={cn("mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border", fd.attested ? "border-brand bg-brand text-brand-foreground" : "border-input")}>{fd.attested && <Check className="h-3.5 w-3.5" />}</span>
            <span>I own or have the rights to sell this file and its contents, and it does not infringe third-party IP.</span>
          </button>
        </div>}
        {kind === "file" && step === 5 && file && <div className="space-y-3 text-sm">
          <div className="flex items-center gap-3">
            <img src={img(fd.image)} alt="" className="h-14 w-24 rounded-md object-cover" />
            <div><div className="text-lg font-semibold">{fd.title}</div><div className="text-muted-foreground">{fd.tagline}</div></div>
          </div>
          <div className="num">{file.fileName} · {file.fileType} · {file.fileSize} · v{fd.version}</div>
          <div>{fd.category} · {fd.compatibility}</div>
          <div className="num">
            {fd.format === "auction"
              ? `Auction from ${usd(fd.start)}, reserve ${usd(fd.reserve)}, ${fd.days} days · single exclusive copy`
              : `Buy now ${usd(fd.buyNow)} · ${fd.invMode === "unlimited" ? "unlimited sales" : `${fd.quantity} copies`}`}
          </div>
          <div className="rounded-md bg-secondary p-3 text-xs text-muted-foreground">Delivery: buyer pays into escrow, you release file access in the deal room, funds release on buyer confirmation.</div>
        </div>}

        <div className="mt-8 flex justify-between border-t border-border pt-4">
          <Button variant="outline" disabled={step === 0} onClick={() => setStep(step - 1)}>Back</Button>
          {step < steps.length - 1
            ? (step === 0 ? null : <Button disabled={!canNext} onClick={() => setStep(step + 1)}>Continue</Button>)
            : <Button variant="brand" onClick={kind === "file" ? publishFile : publishExperience}>Publish listing</Button>}
        </div>
      </div>
    </div>
  );
}

type SaleState = { format: "auction" | "buy_now"; start: number; reserve: number; buyNow: number; days: number };

function SaleFormat({ d, up, showInventory }: { d: SaleState; up: (p: Partial<SaleState>) => void; showInventory: boolean }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">{(["auction", "buy_now"] as const).map((f) => <Button key={f} variant={d.format === f ? "primary" : "outline"} onClick={() => up({ format: f })}>{f === "auction" ? "Auction" : "Buy now"}</Button>)}</div>
      <div className="grid gap-4 sm:grid-cols-2">
        {d.format === "auction" && <><F label="Starting bid"><input className="field num" value={d.start} onChange={(e) => up({ start: Number(e.target.value.replace(/\D/g, "")) })} /></F>
        <F label="Reserve"><input className="field num" value={d.reserve} onChange={(e) => up({ reserve: Number(e.target.value.replace(/\D/g, "")) })} /></F>
        <F label="Duration (days)"><select className="field" value={d.days} onChange={(e) => up({ days: Number(e.target.value) })}>{[3, 5, 7, 10].map((n) => <option key={n} value={n}>{n}</option>)}</select></F></>}
        <F label={showInventory && d.format === "buy_now" ? "Price" : "Buy-now price"}><input className="field num" value={d.buyNow} onChange={(e) => up({ buyNow: Number(e.target.value.replace(/\D/g, "")) })} /></F>
      </div>
    </div>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-sm font-medium">{label}</span>{children}</label>;
}
