import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { BadgeCheck, Building2, Check, FileUp, Link2, ShieldX, Upload } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { GalleryEditor } from "@/components/sb/GalleryEditor";
import { ListingImage } from "@/components/sb/ListingImage";
import { normalizeGallery, type GalleryImage } from "@/lib/gallery";
import { getRobloxMetadata } from "@/lib/roblox-metadata.functions";
import { useState } from "react";
import { toast } from "sonner";
import { CurrencyInput } from "@/components/sb/CurrencyInput";
import { useNow } from "@/components/sb/Countdown";
import { Button, PageHeader } from "@/components/sb/ui";
import { computeEndsAt, defaultEndLocal, formatAuctionEnd, localTimezone, toLocalInputValue, validateAuctionEnd, type EndMode } from "@/lib/auction-end";
import { centsToDollars } from "@/lib/currency";
import { FILE_CATEGORIES, ME, ME_NAME, type FileCategory, type FileMeta, type Listing } from "@/lib/data";
import { usd, usdPrecise } from "@/lib/format";
import { img } from "@/lib/images";
import { TagPicker } from "@/components/sb/TagPicker";
import { suggestTags } from "@/lib/tags";
import { DEMO_OWNED_URL, DEMO_URLS, VERIFY_ERRORS, verifyOwnership, type VerifiedExperience, type VerifyFailure } from "@/lib/roblox";
import { actions, useAppState } from "@/lib/store";
import { cn } from "@/lib/utils";
import mark from "@/assets/bestottr-icon-white.png";

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

const EXP_STEPS = ["Listing type", "Connect Roblox", "Experience link", "Customize listing", "Details", "Financials", "Sale format", "Assets", "Review"];
const FILE_STEPS = ["Listing type", "File upload", "Details", "Sale setup", "License & rights", "Review"];
const ASSETS = ["Experience & all places", "Full source code", "Private packages", "Roblox group", "Game icon & thumbnails", "Discord server", "Social accounts", "Analytics dashboards"];
const DEMO_FILES = [
  { fileName: "combat-system_v2.0.rbxm", fileType: ".rbxm", fileSize: "3.2 MB" },
  { fileName: "ui-pack_v1.4.rbxm", fileType: ".rbxm", fileSize: "5.8 MB" },
  { fileName: "asset-bundle_v3.1.zip", fileType: ".zip", fileSize: "64 MB" },
];
const PREVIEWS = ["f1", "f2", "f3", "f4", "f5", "f6"];
const meSeller = { handle: ME, name: ME_NAME, rating: 4.9, sales: 2, joined: "2020", verified: true, responseTime: "< 1h" };

export function Sell({ editing }: { editing?: Listing } = {}) {
  const s = useAppState();
  const nav = useNavigate();
  const [kind, setKind] = useState<"experience" | "file" | null>(editing ? "experience" : null);
  const [step, setStep] = useState(editing ? 3 : 0);
  const [busy, setBusy] = useState(false);
  const [url, setUrl] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState<{ exp: VerifiedExperience; via?: string | undefined } | null>(null);
  const metadata = useServerFn(getRobloxMetadata);
  const [gallery, setGallery] = useState<GalleryImage[]>(editing ? normalizeGallery(editing) : []);
  const [identity, setIdentity] = useState(editing?.experience);
  const [verr, setVerr] = useState<VerifyFailure | null>(null);
  const [d, setD] = useState({ title: "", tagline: "", description: "", rev: 0, profit: 0, format: "auction" as "auction" | "buy_now", start: 1000000, reserve: 1500000, buyNow: 2500000, endMode: "duration" as EndMode, days: 7, endAtLocal: defaultEndLocal(), assets: ASSETS.slice(0, 5), tags: [] as string[], ...(editing ? { title: editing.title, tagline: editing.tagline, description: editing.description, rev: editing.monthlyRevenue, profit: editing.monthlyProfit, format: editing.format, start: Math.round(editing.startingBid * 100), reserve: Math.round((editing.reserve ?? 0) * 100), buyNow: Math.round((editing.buyNow ?? 0) * 100), endMode: "datetime" as EndMode, endAtLocal: toLocalInputValue(editing.endsAt), assets: [...editing.assets], tags: [...(editing.tags ?? [])] } : {}) });
  const up = (p: Partial<typeof d>) => setD((x) => ({ ...x, ...p }));

  // File listing state
  const [fd, setFd] = useState({
    title: "", tagline: "", description: "", category: "Scripts" as FileCategory,
    version: "1.0.0", compatibility: "", includedFiles: "", license: "", sellerNotes: "",
    format: "buy_now" as "auction" | "buy_now", start: 10000, reserve: 25000, buyNow: 9900, endMode: "duration" as EndMode, days: 7, endAtLocal: defaultEndLocal(),
    invMode: "unlimited" as "unlimited" | "limited", quantity: 10, image: "f1", attested: false,
  });
  const [file, setFile] = useState<(typeof DEMO_FILES)[number] | null>(null);
  const [uploading, setUploading] = useState(false);
  const fup = (p: Partial<typeof fd>) => setFd((x) => ({ ...x, ...p }));

  const steps = kind === "file" ? FILE_STEPS : EXP_STEPS;
  const now = useNow();

  const expEnd = validateAuctionEnd(d.endMode, d.days, d.endAtLocal, now ?? Date.now());
  const fileEnd = validateAuctionEnd(fd.endMode, fd.days, fd.endAtLocal, now ?? Date.now());
  const publishable = kind === "file"
    ? !!file && (fd.format !== "auction" || fileEnd.ok)
    : (!!editing || (!!verified && s.roblox.connected)) && gallery.length > 0 && d.title.trim().length > 2 && (d.format !== "auction" || expEnd.ok || (!!editing && d.endAtLocal === toLocalInputValue(editing.endsAt)));
  const expCanNext = [kind !== null, s.roblox.connected, !!verified, d.title.trim().length > 2 && gallery.length > 0, d.title.length > 2, d.rev > 0, d.format === "auction" ? d.start > 0 && expEnd.ok : d.buyNow > 0, d.assets.length > 0, true][step];
  const fileCanNext = [kind !== null, !!file, fd.title.length > 2 && fd.compatibility.length > 2, fd.format === "auction" ? fd.start > 0 && fileEnd.ok : fd.buyNow > 0, fd.license.length > 5 && fd.attested, true][step];
  const canNext = kind === "file" ? fileCanNext : (editing && step === 6 && d.format === "auction" && d.endMode === "datetime" && d.endAtLocal === toLocalInputValue(editing.endsAt) ? d.start > 0 : expCanNext);

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

  async function runVerify() {
    setVerifying(true);
    setVerr(null);
    setVerified(null);
    setGallery([]);
    const r = verifyOwnership(url, s.roblox);
    if (!r.ok) { setVerr(r.reason); setVerifying(false); return; }
    try {
      const current = await metadata({ data: { placeId: r.exp.placeId } });
      const exp = { ...r.exp, title: current.name || r.exp.title };
      setVerified({ exp, via: r.via });
      setIdentity({ placeId: exp.placeId, universeId: current.universeId, name: exp.title, creatorType: exp.creatorType, creatorName: exp.creatorName });
      setGallery(current.thumbnails);
      up({ title: exp.title, rev: exp.monthlyRevenue, profit: exp.monthlyProfit });
    } catch {
      setVerified({ exp: r.exp, via: r.via });
      setIdentity({ placeId: r.exp.placeId, name: r.exp.title, creatorType: r.exp.creatorType, creatorName: r.exp.creatorName });
      up({ title: r.exp.title, rev: r.exp.monthlyRevenue, profit: r.exp.monthlyProfit });
    } finally { setVerifying(false); }
  }

  function disconnect() {
    actions.disconnectRoblox();
    setVerified(null);
    setVerr(null);
    setUrl("");
  }

  function publishExperience() {
    if (editing) {
      const unchangedEnd = d.endAtLocal === toLocalInputValue(editing.endsAt) && d.endMode === "datetime";
      const end = validateAuctionEnd(d.endMode, d.days, d.endAtLocal);
      if (d.format === "auction" && !unchangedEnd && !end.ok) { toast.error(end.error); setStep(6); return; }
      const result = actions.updateExperience(editing.id, { ...editing, title: d.title, tagline: d.tagline, description: d.description, tags: d.tags, gallery, monthlyRevenue: d.rev, monthlyProfit: d.profit, format: d.format, startingBid: centsToDollars(d.start), reserve: d.format === "auction" ? centsToDollars(d.reserve) : undefined, buyNow: centsToDollars(d.buyNow), endsAt: d.format === "auction" && !unchangedEnd ? (end.endsAt ?? editing.endsAt) : editing.endsAt, assets: d.assets });
      if (!result.ok) { toast.error(result.error); return; }
      toast.success("Listing changes saved");
      void nav({ to: "/listing/$id", params: { id: editing.id } });
      return;
    }
    if (!gallery.length || gallery.length > 5 || d.title.trim().length < 3) return;
    if (!verified || !s.roblox.connected) return;
    const end = validateAuctionEnd(d.endMode, d.days, d.endAtLocal);
    if (d.format === "auction" && !end.ok) {
      toast.error(end.error ?? "Choose a valid auction end.");
      setStep(6);
      return;
    }
    const id = `new-${Date.now()}`;
    const exp = verified.exp;
    const endsAt = d.format === "auction" ? end.endsAt : computeEndsAt("duration", d.days, "");
    if (endsAt === null) return;
    const l: Listing = {
      id, kind: "experience", title: d.title, tagline: d.tagline, description: d.description, genre: exp.genre, tags: d.tags, image: gallery[0]?.url ?? exp.image, gallery, experience: identity, format: d.format,
      startingBid: centsToDollars(d.format === "auction" ? d.start : d.buyNow), currentBid: centsToDollars(d.format === "auction" ? d.start : d.buyNow),
      reserve: d.format === "auction" ? centsToDollars(d.reserve) : undefined, buyNow: centsToDollars(d.buyNow), endsAt, bids: [], status: "review",
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
    if (!file) return;
    const end = validateAuctionEnd(fd.endMode, fd.days, fd.endAtLocal);
    if (fd.format === "auction" && !end.ok) {
      toast.error(end.error ?? "Choose a valid auction end.");
      setStep(3);
      return;
    }
    const id = `new-${Date.now()}`;
    const meta: FileMeta = {
      fileName: file.fileName, fileType: file.fileType, fileSize: file.fileSize,
      version: fd.version, category: fd.category, compatibility: fd.compatibility,
      includedFiles: fd.includedFiles.split("\n").map((x) => x.trim()).filter(Boolean),
      license: fd.license, sellerNotes: fd.sellerNotes,
      inventory: fd.format === "auction" ? { mode: "limited", total: 1, remaining: 1 } : fd.invMode === "unlimited" ? { mode: "unlimited" } : { mode: "limited", total: fd.quantity, remaining: fd.quantity },
    };
    const endsAt = fd.format === "auction" ? end.endsAt : computeEndsAt("duration", fd.days, "");
    if (endsAt === null) return;
    const l: Listing = {
      id, kind: "file", title: fd.title, tagline: fd.tagline, description: fd.description, genre: fd.category, image: fd.image, format: fd.format,
      startingBid: centsToDollars(fd.format === "auction" ? fd.start : fd.buyNow), currentBid: centsToDollars(fd.format === "auction" ? fd.start : fd.buyNow),
      reserve: fd.format === "auction" ? centsToDollars(fd.reserve) : undefined, buyNow: fd.format === "buy_now" ? centsToDollars(fd.buyNow) : undefined,
      endsAt, bids: [], status: "review",
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
      <PageHeader title={editing ? "Edit listing" : "Create a listing"} subtitle={`Step ${step + 1} of ${steps.length} · ${steps[step]}`} />
      <ol className="mt-6 flex gap-1 overflow-x-auto">
        {steps.map((st, i) => <li key={st} className={cn("h-1.5 min-w-8 flex-1 rounded-full", i <= step ? "bg-foreground" : "bg-secondary")} />)}
      </ol>
      <div className="surface mt-6 p-4 sm:p-6">
        {editing && <div className="mb-5 border-b border-border pb-4 text-sm text-muted-foreground">Verified Experience locked · {identity?.name ?? editing.title}{identity?.placeId ? ` · Place ${identity.placeId}` : ""}</div>}
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
          <div>
            <div className="flex flex-wrap items-center gap-3 rounded-md border border-border p-3">
              <img src={mark} alt="" width={36} height={36} className="h-9 w-auto object-contain" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 text-sm font-semibold">@{s.roblox.username} <BadgeCheck className="h-4 w-4 text-brand" /></div>
                <div className="num text-xs text-muted-foreground">Roblox user ID {s.roblox.userId}</div>
              </div>
              <Button variant="ghost" size="sm" onClick={disconnect}>Disconnect</Button>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">Next you'll paste your experience link. We verify that this account owns the experience directly, or owns the group that owns it — group admins and developers don't qualify.</p>
          </div>
        ) : (
          <div><img src={mark} alt="" width={40} height={40} loading="lazy" className="mb-3 h-10 w-auto" /><p className="text-sm text-muted-foreground">Connect your Roblox account so we can verify that you own the experience you want to list. (Demo — no credentials needed.)</p>
            <Button className="mt-4" disabled={busy} onClick={() => { setBusy(true); setTimeout(() => { actions.connectRoblox(); setBusy(false); }, 900); }}>{busy ? "Connecting…" : "Connect Roblox (demo)"}</Button></div>
        ))}
        {kind === "experience" && step === 2 && (!s.roblox.connected ? (
          <div className="text-sm text-muted-foreground">Connect your Roblox account first — ownership verification runs against the connected account.</div>
        ) : verified ? (
          <div>
            <div className="flex items-start gap-3 rounded-md border border-brand bg-brand-soft p-3">
              <img src={img(verified.exp.image)} alt="" className="h-16 w-28 shrink-0 rounded-md border border-border object-cover" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 font-semibold">{verified.exp.title} <BadgeCheck className="h-4 w-4 shrink-0 text-brand" /></div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {verified.exp.creatorType === "Group" ? "Group" : "User"}-owned · {verified.exp.creatorName} · Place ID <span className="num">{verified.exp.placeId}</span>
                </div>
                <div className="mt-1 text-xs font-medium text-brand">
                  Ownership verified — {verified.via ? `owned through ${verified.via}` : `owned directly by @${s.roblox.username}`}
                </div>
              </div>
            </div>
            <Button variant="ghost" size="sm" className="mt-3" onClick={() => { setVerified(null); setUrl(""); }}>Use a different link</Button>
          </div>
        ) : (
          <div className="space-y-4">
            <F label="Roblox experience link">
              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="relative flex-1">
                  <Link2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    className="field pl-9"
                    placeholder="https://www.roblox.com/games/…"
                    value={url}
                    onChange={(e) => { setUrl(e.target.value); setVerr(null); }}
                    onKeyDown={(e) => { if (e.key === "Enter" && url.trim() && !verifying) runVerify(); }}
                    aria-label="Roblox experience link"
                  />
                </div>
                <Button disabled={verifying || !url.trim()} onClick={runVerify}>{verifying ? "Verifying ownership…" : "Verify ownership"}</Button>
              </div>
            </F>
            {verr && (
              <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
                <ShieldX className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                <span>{VERIFY_ERRORS[verr]}</span>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              We check that <span className="text-foreground">@{s.roblox.username}</span> owns this experience directly, or is the owner of the group that owns it. Membership, admin rank or edit access don't qualify.
            </p>
            <div>
              <div className="eyebrow mb-2">Demo links to try</div>
              <p className="mb-2 text-xs text-muted-foreground">Use this link with the demo Roblox account to test a successful listing.</p>
              <button data-testid="demo-owned-url" onClick={() => { setUrl(DEMO_OWNED_URL); setVerr(null); }} className="mb-3 block w-full rounded-md border border-foreground/50 px-3 py-2 text-left transition-colors hover:border-foreground">
                <div className="flex items-center gap-1.5 text-xs font-medium"><BadgeCheck className="h-3.5 w-3.5 text-brand" /> Demo owned experience — works with connected demo account</div>
                <div className="num mt-0.5 truncate text-xs text-muted-foreground">{DEMO_OWNED_URL}</div>
              </button>
              <div className="mb-1.5 text-xs text-muted-foreground">Other outcomes (group owner passes; others fail)</div>
              <div className="space-y-1.5">
                {DEMO_URLS.map((u) => (
                  <button key={u} onClick={() => { setUrl(u); setVerr(null); }} className="num block w-full truncate rounded-md border border-border px-3 py-2 text-left text-xs text-muted-foreground transition-colors hover:border-foreground hover:text-foreground">
                    {u}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ))}
        {kind === "experience" && step === 3 && <GalleryEditor title={d.title} onTitleChange={(title) => up({ title })} images={gallery} onChange={setGallery} />}
        {kind === "experience" && step === 4 && <div className="space-y-4">
          <F label="Title"><input className="field" value={d.title} onChange={(e) => up({ title: e.target.value })} /></F>
          <F label="Tagline"><input className="field" value={d.tagline} onChange={(e) => up({ tagline: e.target.value })} /></F>
          <F label="Description"><textarea className="field h-28 py-2" value={d.description} onChange={(e) => up({ description: e.target.value })} /></F>
          <TagPicker value={d.tags} onChange={(tags) => up({ tags })} suggested={suggestTags({ genre: verified?.exp.genre, title: d.title, tagline: d.tagline, description: d.description })} />
        </div>}
        {kind === "experience" && step === 5 && <div className="grid gap-4 sm:grid-cols-2">
          <p className="text-sm text-brand sm:col-span-2">Pre-filled from verified Roblox analytics.</p>
          <F label="Monthly revenue (USD)"><input className="field num" inputMode="numeric" value={d.rev} onChange={(e) => up({ rev: Number(e.target.value.replace(/\D/g, "")) })} /></F>
          <F label="Monthly profit (USD)"><input className="field num" inputMode="numeric" value={d.profit} onChange={(e) => up({ profit: Number(e.target.value.replace(/\D/g, "")) })} /></F>
        </div>}
        {kind === "experience" && step === 6 && <SaleFormat d={d} up={up} showInventory={false} />}
        {kind === "experience" && step === 7 && <div className="grid gap-2 sm:grid-cols-2">{ASSETS.map((a) => {
          const on = d.assets.includes(a);
          return <button key={a} onClick={() => up({ assets: on ? d.assets.filter((x) => x !== a) : [...d.assets, a] })} className="flex items-center gap-3 rounded-md border border-border p-3 text-left text-sm">
            <span className={cn("flex h-5 w-5 items-center justify-center rounded border", on ? "border-brand bg-brand text-brand-foreground" : "border-input")}>{on && <Check className="h-3.5 w-3.5" />}</span>{a}</button>;
        })}</div>}
        {kind === "experience" && step === 8 && (verified || editing) && <div className="space-y-2 text-sm">
          {verified && <div className="flex items-center gap-3 rounded-md border border-brand bg-brand-soft p-3">
            <img src={img(verified.exp.image)} alt="" className="h-12 w-20 shrink-0 rounded-md border border-border object-cover" />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 font-semibold">{verified.exp.title} <BadgeCheck className="h-4 w-4 shrink-0 text-brand" /></div>
              <div className="text-xs text-muted-foreground">
                {verified.exp.creatorType === "Group" ? `Group-owned · ${verified.exp.creatorName}` : "User-owned"} · Place ID <span className="num">{verified.exp.placeId}</span> · ownership verified
              </div>
            </div>
          </div>}
          <ListingImage image={gallery[0]?.url ?? ""} alt="Listing cover" className="aspect-video w-full rounded-md object-cover" />
          <div className="text-lg font-semibold">{d.title}</div><div className="text-muted-foreground">{d.tagline}</div>
          {d.tags.length > 0 && <div className="flex flex-wrap gap-1.5" data-testid="review-tags">{d.tags.map((t) => <span key={t} className="rounded-md border border-border px-2 py-0.5 text-xs text-muted-foreground">{t}</span>)}</div>}
          <div className="num">Revenue {usd(d.rev)}/mo · Profit {usd(d.profit)}/mo</div>
          <div className="num">{d.format === "auction" ? `Auction from ${usdPrecise(centsToDollars(d.start))}, reserve ${usdPrecise(centsToDollars(d.reserve))} · ends ${d.endMode === "datetime" ? formatAuctionEnd(new Date(d.endAtLocal).getTime()) : `in ${d.days} days`}` : "Buy now"} · Buy-now {usdPrecise(centsToDollars(d.buyNow))}</div>
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
              ? `Auction from ${usdPrecise(centsToDollars(fd.start))}, reserve ${usdPrecise(centsToDollars(fd.reserve))} · ends ${fd.endMode === "datetime" ? formatAuctionEnd(new Date(fd.endAtLocal).getTime()) : `in ${fd.days} days`} · single exclusive copy`
              : `Buy now ${usdPrecise(centsToDollars(fd.buyNow))} · ${fd.invMode === "unlimited" ? "unlimited sales" : `${fd.quantity} copies`}`}
          </div>
          <div className="rounded-md bg-secondary p-3 text-xs text-muted-foreground">Demo delivery: file access is granted instantly after payment or an auction win. No seller release or buyer confirmation is required.</div>
        </div>}

        <div className="mt-8 flex justify-between border-t border-border pt-4">
          <Button variant="outline" disabled={step === 0 || (!!editing && step === 3)} onClick={() => setStep(step - 1)}>Back</Button>
          {editing && <Button variant="ghost" onClick={() => nav({ to: "/listing/$id", params: { id: editing.id } })}>Cancel</Button>}
          {step < steps.length - 1
            ? (step === 0 ? null : <Button disabled={!canNext} onClick={() => setStep(step + 1)}>Continue</Button>)
            : <Button variant="brand" disabled={!publishable} onClick={kind === "file" ? publishFile : publishExperience}>{editing ? "Save changes" : "Publish listing"}</Button>}
        </div>
      </div>
    </div>
  );
}

type SaleState = { format: "auction" | "buy_now"; start: number; reserve: number; buyNow: number; endMode: EndMode; days: number; endAtLocal: string };

function SaleFormat({ d, up, showInventory }: { d: SaleState; up: (p: Partial<SaleState>) => void; showInventory: boolean }) {
  const now = useNow();
  const end = validateAuctionEnd(d.endMode, d.days, d.endAtLocal, now ?? Date.now());
  const tz = localTimezone();
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">{(["auction", "buy_now"] as const).map((f) => <Button key={f} variant={d.format === f ? "primary" : "outline"} onClick={() => up({ format: f })}>{f === "auction" ? "Auction" : "Buy now"}</Button>)}</div>
      <div className="grid gap-4 sm:grid-cols-2">
        {d.format === "auction" && <>
          <F label="Starting bid"><CurrencyInput label="Starting bid" valueCents={d.start} onChange={(c) => up({ start: c })} /></F>
          <F label="Reserve"><CurrencyInput label="Reserve" valueCents={d.reserve} onChange={(c) => up({ reserve: c })} /></F>
        </>}
        <F label={showInventory && d.format === "buy_now" ? "Price" : "Buy-now price"}><CurrencyInput label="Buy-now price" valueCents={d.buyNow} onChange={(c) => up({ buyNow: c })} /></F>
      </div>
      {d.format === "auction" && (
        <div>
          <span className="mb-1.5 block text-sm font-medium">Auction end</span>
          <div className="grid grid-cols-2 gap-2">
            {(["duration", "datetime"] as const).map((m) => (
              <Button key={m} variant={d.endMode === m ? "primary" : "outline"} onClick={() => up({ endMode: m })}>{m === "duration" ? "Duration" : "Specific date & time"}</Button>
            ))}
          </div>
          <div className="mt-3">
            {d.endMode === "duration" ? (
              <F label="Duration (days)"><select className="field" value={d.days} onChange={(e) => up({ days: Number(e.target.value) })}>{[3, 5, 7, 10].map((n) => <option key={n} value={n}>{n}</option>)}</select></F>
            ) : (
              <F label={`Ends at${tz ? ` (${tz})` : ""}`}>
                <input type="datetime-local" className="field num" value={d.endAtLocal} min={toLocalInputValue(Date.now())} onChange={(e) => up({ endAtLocal: e.target.value })} aria-label="Auction end date and time" />
              </F>
            )}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Bids stop exactly at this time{tz ? ` — shown in your local timezone (${tz})` : ""}.</p>
          {d.endMode === "datetime" && !end.ok && end.error && <p className="mt-2 text-xs text-destructive">{end.error}</p>}
        </div>
      )}
    </div>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-sm font-medium">{label}</span>{children}</label>;
}
