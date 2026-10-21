import { createFileRoute, Link } from "@tanstack/react-router";
import { Landmark, ArrowDownToLine, ShieldCheck } from "lucide-react";
import { AccountLayout, AccountPanel } from "@/components/account/AccountLayout";
import { Badge } from "@/components/sb/ui";
export const Route = createFileRoute("/account_/payouts")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Deposits & payouts — bestottr" }, { name: "robots", content: "noindex" }],
  }),
  component: Payouts,
});
function Payouts() {
  return (
    <AccountLayout
      title="Deposits & payouts"
      description="Funding purchases and receiving proceeds from your sales."
    >
      <AccountPanel title="Deposit availability">
        <div className="flex gap-3">
          <ArrowDownToLine className="h-5 w-5 shrink-0 text-muted-foreground" />
          <div>
            <Badge tone="neutral">Not enabled</Badge>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Deposits are not open. There is no stored balance to fund or withdraw, and no deposit
              instructions have been issued.
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              When funding opens, your transaction will show the exact amount, provider and next
              steps before you pay.
            </p>
          </div>
        </div>
      </AccountPanel>
      <AccountPanel title="Payout destination">
        <div className="rounded-md border border-dashed border-border px-5 py-8 text-center">
          <Landmark className="mx-auto h-7 w-7 text-muted-foreground" />
          <p className="mt-4 text-sm font-medium">No payout account connected</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Payout onboarding will open after a provider is selected. You’ll complete identity
            checks and add your bank account directly with that provider.
          </p>
        </div>
      </AccountPanel>
      <AccountPanel title="Transaction protection">
        <div className="flex items-start gap-3">
          <ShieldCheck className="h-5 w-5 shrink-0 text-muted-foreground" />
          <div className="text-sm leading-relaxed text-muted-foreground">
            <p>
              No escrow service is currently connected. Your account does not hold funds in escrow.
            </p>
            <p className="mt-2">
              Funding, release conditions, refunds and disputes must be defined with the selected
              provider before trading opens.
            </p>
          </div>
        </div>
      </AccountPanel>
      <Link to="/account/verification" className="text-sm underline underline-offset-4">
        Review your verification status
      </Link>
    </AccountLayout>
  );
}
