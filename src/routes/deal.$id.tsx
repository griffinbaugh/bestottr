import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, Download } from "lucide-react";
import { toast } from "sonner";
import { Button, Empty, Stat, buttonVariants } from "@/components/sb/ui";
import { LICENSE_TERMS, type Deal, type Listing } from "@/lib/data";
import { AcquisitionRoom } from "@/components/sb/AcquisitionRoom";
import { usd } from "@/lib/format";
import { useAppState } from "@/lib/store";

export const Route = createFileRoute("/deal/$id")({
  head: () => ({
    meta: [
      { title: "Acquisition room — bestottr" },
      { name: "description", content: "Acquisition room: protected funds, locked destination account and automatic Roblox ownership verification." },
      { property: "og:title", content: "Deal room — bestottr" },
      { property: "og:description", content: "Private transaction room for a bestottr deal." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DealRoom,
});

/** File transactions are fulfilled instantly: this is a receipt/access page, not a staged deal room. */
function FileReceipt({ d, l }: { d: Deal; l: Listing }) {
  const f = l.file;
  const won = l.format === "auction";
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 md:px-6">
      <div className="surface overflow-hidden">
        <div className="border-b border-border p-6 text-center md:p-8">
          <CheckCircle2 className="mx-auto h-12 w-12 text-brand" />
          <div className="eyebrow mt-4">{won ? "Auction won" : "Purchase complete"} · #{d.id}</div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">{l.title}</h1>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Payment confirmed and file access granted instantly. bestottr delivers digital files automatically — no seller action needed.
          </p>
          <Button size="lg" className="mt-5" onClick={() => toast.success("Demo download started", { description: "Mock access action — no real file is stored in this prototype." })}>
            <Download className="h-4 w-4" /> Download file (demo)
          </Button>
          <p className="mt-2 text-xs text-muted-foreground">Demo access — no real file is stored in this prototype.</p>
        </div>
        <div className="grid grid-cols-2 gap-x-5 gap-y-6 p-6 sm:grid-cols-4">
          <Stat label="File" value={f?.fileType ?? "—"} hint={f?.fileSize} />
          <Stat label="Version" value={f ? `v${f.version}` : "—"} />
          <Stat label="Category" value={f?.category ?? "—"} />
          <Stat label="Purchased" value={new Date(d.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} />
        </div>
        <div className="grid gap-4 border-t border-border p-6 sm:grid-cols-3">
          <Stat label="Purchase price" value={usd(d.price)} />
          <Stat label="Platform fee (2.5%)" value={usd(d.fee)} />
          <Stat label="Total paid" value={usd(d.price + d.fee)} />
        </div>
        <div className="border-t border-border p-6">
          <div className="text-sm font-medium">Seller</div>
          <div className="mt-1 text-sm text-muted-foreground">{l.seller.name} (@{d.seller})</div>
          <div className="mt-4 text-sm font-medium">License & usage</div>
          <p className="mt-1 rounded-md bg-secondary p-3 text-xs text-muted-foreground">{LICENSE_TERMS}</p>
        </div>
        <div className="border-t border-border p-6">
          <h3 className="mb-3 text-sm font-semibold">Activity</h3>
          <ul className="space-y-2 text-sm">{d.log.map((e, i) => <li key={i} className="text-muted-foreground">{e.text}</li>)}</ul>
        </div>
      </div>
      <div className="mt-4 text-center">
        <Link to="/dashboard" className={buttonVariants({ variant: "outline" })}>Back to dashboard</Link>
      </div>
    </div>
  );
}

function DealRoom() {
  const { id } = Route.useParams();
  const s = useAppState();
  const d = s.deals.find((x) => x.id === id);
  const l = d && s.listings.find((x) => x.id === d.listingId);
  if (!d || !l) return <div className="mx-auto max-w-3xl px-4 py-16"><Empty title="Deal not found" action={<Link to="/dashboard" className={buttonVariants({ variant: "outline" })}>Go to dashboard</Link>} /></div>;
  if (d.kind === "file") return <FileReceipt d={d} l={l} />;
  if (d.acquisition) return <AcquisitionRoom d={d} l={l} s={s} />;
  return <div className="mx-auto max-w-3xl px-4 py-16"><Empty title="This deal needs support review" body="It was created before automated ownership verification." action={<Link to="/support" className={buttonVariants({ variant: "outline" })}>Contact support</Link>} /></div>;
}
