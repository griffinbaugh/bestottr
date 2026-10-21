import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, Clock3, ArrowRight } from "lucide-react";
import { useAuth } from "@/components/account/AuthProvider";
import { AccountLayout, AccountPanel } from "@/components/account/AccountLayout";
import { Badge } from "@/components/sb/ui";
export const Route = createFileRoute("/account_/verification")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Verification — bestottr" }, { name: "robots", content: "noindex" }],
  }),
  component: Verification,
});
function Verification() {
  const { session, roblox } = useAuth();
  return (
    <AccountLayout
      title="Verification"
      description="See what’s confirmed and what still needs attention."
    >
      <AccountPanel title="Your verification status">
        <div className="divide-y divide-border">
          {[
            {
              name: "Email address",
              detail: session?.user.email ?? "",
              done: !!session?.user.email_confirmed_at,
              to: "/verify-email",
              action: "Verify email",
            },
            {
              name: "Roblox identity",
              detail: roblox
                ? `@${roblox.username} · ${roblox.roblox_user_id}`
                : "Connect your Roblox account directly.",
              done: !!roblox,
              to: "/account/connections",
              action: "Connect Roblox",
            },
          ].map((x) => (
            <div className="flex flex-wrap items-center gap-3 py-4 first:pt-0" key={x.name}>
              {x.done ? (
                <CheckCircle2 className="h-5 w-5 text-brand" />
              ) : (
                <Clock3 className="h-5 w-5 text-muted-foreground" />
              )}
              <div className="flex-1">
                <p className="text-sm font-medium">{x.name}</p>
                <p className="mt-1 break-all text-xs text-muted-foreground">{x.detail}</p>
              </div>
              {x.done ? (
                <Badge tone="brand">Confirmed</Badge>
              ) : (
                <Link
                  to={x.to}
                  className="inline-flex items-center gap-1 text-sm underline underline-offset-4"
                >
                  {x.action}
                  <ArrowRight className="h-3 w-3" />
                </Link>
              )}
            </div>
          ))}
        </div>
      </AccountPanel>
      <AccountPanel
        title="Seller & payout verification"
        description="Payment-provider onboarding will collect any required business and identity details before payouts can be enabled."
      >
        <Badge tone="neutral">Not available yet</Badge>
        <p className="mt-4 text-sm text-muted-foreground">
          There is no payment or escrow provider connected yet. We won’t ask you to upload identity
          documents or bank details here. When onboarding opens, complete verification directly with
          the provider.
        </p>
      </AccountPanel>
      <AccountPanel
        title="Listing ownership"
        description="Email verification and Roblox identity do not prove ownership of every listing."
      >
        <p className="text-sm text-muted-foreground">
          An experience must be owned by your linked Roblox user or a community you own. That
          ownership check is separate from account verification and must be repeated before a
          transfer completes.
        </p>
      </AccountPanel>
    </AccountLayout>
  );
}
