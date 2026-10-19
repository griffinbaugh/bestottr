import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, CheckCircle2, Wand2 } from "lucide-react";
import { useState } from "react";
import { Badge, Button, Empty, Stat, buttonVariants } from "@/components/sb/ui";
import { DD_ITEMS, ME, STAGES, TRANSFER_ITEMS } from "@/lib/data";
import { usd } from "@/lib/format";
import { img } from "@/lib/images";
import { actions, stageDone, useAppState } from "@/lib/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/deal/$id")({
  head: () => ({
    meta: [
      { title: "Deal room — StudioBid" },
      { name: "description", content: "Private acquisition room: agreement, escrow, due diligence and Roblox ownership transfer." },
      { property: "og:title", content: "Deal room — StudioBid" },
      { property: "og:description", content: "Private acquisition room for a StudioBid transaction." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DealRoom,
});

function DealRoom() {
  const { id } = Route.useParams();
  const s = useAppState();
  const d = s.deals.find((x) => x.id === id);
  const [role, setRole] = useState<"buyer" | "seller">(d?.seller === ME ? "seller" : "buyer");
  if (!d) return <div className="mx-auto max-w-3xl px-4 py-16"><Empty title="Deal not found" action={<Link to="/dashboard" className={buttonVariants({ variant: "outline" })}>Go to dashboard</Link>} /></div>;
  const l = s.listings.find((x) => x.id === d.listingId)!;
  const done = stageDone(d);

  const Check3 = ({ group, items, who }: { group: "dd" | "transfer" | "received"; items: { id: string; label: string; detail: string }[]; who: "buyer" | "seller" }) => (
    <ul className="divide-y divide-border">
      {items.map((i) => {
        const v = d[group][i.id];
        return (
          <li key={i.id}>
            <button disabled={role !== who} onClick={() => actions.toggle(d.id, group, i.id)} className="flex w-full items-start gap-3 py-3 text-left disabled:cursor-not-allowed">
              <span className={cn("mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border", v ? "border-brand bg-brand text-brand-foreground" : "border-input")}>{v && <Check className="h-3.5 w-3.5" />}</span>
              <span><span className="block text-sm font-medium">{i.label}</span><span className="text-xs text-muted-foreground">{i.detail}</span></span>
            </button>
          </li>
        );
      })}
    </ul>
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 md:px-6">
      <div className="flex flex-wrap items-center gap-4">
        <img src={img(l.image)} alt="" className="h-16 w-28 rounded-md object-cover" />
        <div className="flex-1">
          <div className="eyebrow">Deal room · #{d.id}</div>
          <h1 className="text-2xl font-semibold tracking-tight">{l.title}</h1>
        </div>
        <div className="flex rounded-md bg-secondary p-1 text-sm">
          {(["buyer", "seller"] as const).map((r) => (
            <button key={r} onClick={() => setRole(r)} className={cn("rounded px-3 py-1.5 capitalize", role === r ? "bg-card shadow-sm" : "text-muted-foreground")}>View as {r}</button>
          ))}
        </div>
      </div>

      <div className="surface mt-6 grid grid-cols-2 gap-5 p-5 md:grid-cols-4">
        <Stat label="Purchase price" value={usd(d.price)} />
        <Stat label="Platform fee (2.5%)" value={usd(d.fee)} />
        <Stat label="Buyer total" value={usd(d.price + d.fee)} />
        <Stat label="Escrow" value={d.funded ? "Funded" : "Awaiting funds"} />
      </div>

      <ol className="mt-6 grid grid-cols-3 gap-2 md:grid-cols-6">
        {STAGES.map((st, i) => (
          <li key={st} className={cn("rounded-md border px-3 py-2 text-xs font-medium", i < d.stage ? "border-brand bg-brand-soft text-brand" : i === d.stage ? "border-foreground" : "border-border text-muted-foreground")}>
            <span className="num mr-1">{i + 1}</span>{st}
          </li>
        ))}
      </ol>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        <section className="surface p-5">
          <h2 className="mb-4 text-lg font-semibold">{STAGES[d.stage]}</h2>
          {d.stage === 0 && (
            <div className="space-y-3 text-sm">
              <p className="text-muted-foreground">Asset Purchase Agreement covering the experience, IP, and all listed assets. Both parties must sign.</p>
              {(["buyer", "seller"] as const).map((p) => (
                <div key={p} className="flex items-center justify-between rounded-md border border-border p-3">
                  <span className="capitalize">{p} signature</span>
                  {d.agreement[p] ? <Badge tone="brand">Signed</Badge> : <Button size="sm" disabled={role !== p} onClick={() => actions.signAgreement(d.id, p)}>Sign as {p}</Button>}
                </div>
              ))}
            </div>
          )}
          {d.stage === 1 && (
            <div className="text-sm">
              <p className="text-muted-foreground">Buyer deposits {usd(d.price + d.fee)} into escrow. Funds release only after final verification.</p>
              {d.funded ? <Badge tone="brand" className="mt-3">Escrow funded</Badge> : <Button className="mt-4" disabled={role !== "buyer"} onClick={() => actions.fund(d.id)}>Fund escrow (demo)</Button>}
            </div>
          )}
          {d.stage === 2 && <Check3 group="dd" items={DD_ITEMS} who="buyer" />}
          {d.stage === 3 && <><p className="mb-2 text-sm text-muted-foreground">Seller marks each item as transferred.</p><Check3 group="transfer" items={TRANSFER_ITEMS} who="seller" /></>}
          {d.stage === 4 && <><p className="mb-2 text-sm text-muted-foreground">Buyer confirms receipt of each item.</p><Check3 group="received" items={TRANSFER_ITEMS} who="buyer" /></>}
          {d.stage === 5 && (
            <div className="py-8 text-center">
              <CheckCircle2 className="mx-auto h-12 w-12 text-brand" />
              <div className="mt-3 text-xl font-semibold">Transaction complete</div>
              <p className="mt-1 text-sm text-muted-foreground">Ownership transferred and {usd(d.price)} released to the seller.</p>
            </div>
          )}
          {d.stage < 5 && (
            <div className="mt-6 flex flex-wrap gap-2 border-t border-border pt-4">
              <Button disabled={!done} onClick={() => actions.advance(d.id)}>{d.stage === 4 ? "Confirm & release funds" : "Continue to next stage"}</Button>
              <Button variant="demo" onClick={() => actions.autoComplete(d.id)}><Wand2 className="h-4 w-4" />Demo: complete this stage</Button>
            </div>
          )}
        </section>
        <aside className="surface h-fit p-5">
          <h3 className="mb-3 font-semibold">Activity</h3>
          <ul className="space-y-3 text-sm">{d.log.map((e, i) => <li key={i} className="text-muted-foreground">{e.text}</li>)}</ul>
        </aside>
      </div>
    </div>
  );
}
