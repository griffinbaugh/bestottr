import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { Listing } from "@/lib/data";
import { usd } from "@/lib/format";
import { buyerPremium, minNextBid, totalCommitment, BUYER_PREMIUM_RATE } from "@/lib/pricing";
import { actions } from "@/lib/store";
import { Button } from "./ui";

export function BidDialog({ listing: l, open, onOpenChange }: { listing: Listing; open: boolean; onOpenChange: (o: boolean) => void }) {
  const min = minNextBid(l.currentBid, l.bids.length > 0, l.startingBid);
  const [raw, setRaw] = useState(String(min));
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setRaw(String(min));
      setAgree(false);
      setError(null);
    }
  }, [open, min]);

  const amount = Number(raw.replace(/[^0-9]/g, ""));
  const valid = amount >= min;
  const overBuyNow = l.buyNow && amount >= l.buyNow;

  function submit() {
    if (!valid) return setError(`Bid must be at least ${usd(min)}.`);
    if (!agree) return setError("Please confirm this bid is binding.");
    const r = actions.placeBid(l.id, amount);
    if (!r.ok) return setError(r.error ?? "Bid failed");
    toast.success(`Bid of ${usd(amount)} placed`, { description: "You're the highest bidder." });
    onOpenChange(false);
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-overlay data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content className="surface fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 p-6 data-[state=open]:animate-in data-[state=open]:zoom-in-95">
          <div className="flex items-start justify-between">
            <div>
              <Dialog.Title className="text-lg font-semibold">Place a bid</Dialog.Title>
              <Dialog.Description className="text-sm text-muted-foreground">{l.title}</Dialog.Description>
            </div>
            <Dialog.Close className="rounded p-1 text-muted-foreground hover:bg-accent" aria-label="Close">
              <X className="h-5 w-5" />
            </Dialog.Close>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 rounded-lg bg-muted p-3 text-sm">
            <div>
              <div className="text-muted-foreground">Current bid</div>
              <div className="num font-semibold">{usd(l.currentBid)}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Minimum next bid</div>
              <div className="num font-semibold">{usd(min)}</div>
            </div>
          </div>

          <label className="mt-5 block text-sm font-medium" htmlFor="bid-amount">Your maximum bid (USD)</label>
          <div className="relative mt-1.5">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
            <input
              id="bid-amount"
              inputMode="numeric"
              className="field num pl-7 text-lg"
              value={amount ? amount.toLocaleString("en-US") : ""}
              onChange={(e) => {
                setRaw(e.target.value);
                setError(null);
              }}
            />
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {[min, min + 1000, min + 5000].map((v) => (
              <button key={v} onClick={() => setRaw(String(v))} className="num rounded-md border border-border px-2.5 py-1 text-xs hover:bg-accent">
                {usd(v)}
              </button>
            ))}
          </div>
          {!valid && amount > 0 && <p className="mt-2 text-sm text-destructive">Bid must be at least {usd(min)}.</p>}
          {overBuyNow && <p className="mt-2 text-sm text-warning">This exceeds the buy-now price of {usd(l.buyNow!)} — consider Buy Now instead.</p>}

          <div className="mt-5 space-y-2 border-t border-border pt-4 text-sm">
            <Row label="Bid amount" value={usd(amount || 0)} />
            <Row label={`Buyer premium (${BUYER_PREMIUM_RATE * 100}%)`} value={usd(buyerPremium(amount || 0))} />
            <Row label="Total commitment if you win" value={usd(totalCommitment(amount || 0))} strong />
          </div>

          <label className="mt-4 flex items-start gap-2.5 text-sm text-muted-foreground">
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 h-5 w-5 accent-[var(--color-brand)]" />
            I understand this bid is binding. If I win, funds are held by the payment provider until the transfer is verified.
          </label>

          {error && <p className="mt-3 rounded-md bg-live-soft px-3 py-2 text-sm text-destructive">{error}</p>}

          <div className="mt-5 flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button className="flex-1" disabled={!valid || !agree} onClick={submit}>Confirm bid</Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between ${strong ? "font-semibold" : "text-muted-foreground"}`}>
      <span>{label}</span>
      <span className="num text-foreground">{value}</span>
    </div>
  );
}
