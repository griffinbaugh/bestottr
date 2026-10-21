import { createFileRoute, Link } from "@tanstack/react-router";
import { CreditCard, LockKeyhole } from "lucide-react";
import { AccountLayout, AccountPanel } from "@/components/account/AccountLayout";
import { Badge } from "@/components/sb/ui";
export const Route = createFileRoute("/account_/payments")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Payment methods — bestottr" }, { name: "robots", content: "noindex" }],
  }),
  component: Payments,
});
function Payments() {
  return (
    <AccountLayout
      title="Payment methods"
      description="Manage how you pay for purchases on bestottr."
    >
      <AccountPanel title="Saved payment methods">
        <div className="rounded-md border border-dashed border-border px-5 py-10 text-center">
          <CreditCard className="mx-auto h-7 w-7 text-muted-foreground" />
          <h3 className="mt-4 text-sm font-medium">No payment methods saved</h3>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
            Adding a card or bank account will be available when payment processing opens.
          </p>
        </div>
      </AccountPanel>
      <AccountPanel title="Payment availability">
        <Badge tone="neutral">Payments not enabled</Badge>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          BestOttr is not accepting deposits, purchases or funded bids yet. No money will be taken
          through this site until a payment provider is connected and the purchase flow is
          available.
        </p>
        <div className="mt-4 flex items-start gap-2 text-xs text-muted-foreground">
          <LockKeyhole className="h-4 w-4 shrink-0" />
          <p>
            Your full card number, security code and bank credentials will be entered directly with
            the payment provider.
          </p>
        </div>
      </AccountPanel>
      <div className="flex flex-wrap gap-5 text-sm">
        <Link to="/account/payouts" className="underline underline-offset-4">
          Deposits & payouts
        </Link>
        <Link to="/support" className="text-muted-foreground underline underline-offset-4">
          Payment questions?
        </Link>
      </div>
    </AccountLayout>
  );
}
