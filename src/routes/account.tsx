import { createFileRoute, Link } from "@tanstack/react-router";
import { AccountLayout, AccountPanel } from "@/components/account/AccountLayout";
import { useAuth } from "@/components/account/AuthProvider";
import { buttonVariants } from "@/components/sb/ui";
export const Route = createFileRoute("/account")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Your account — bestottr" }, { name: "robots", content: "noindex" }],
  }),
  component: Account,
});
function Account() {
  const { session, profile, roblox } = useAuth();
  return (
    <AccountLayout
      title={profile ? `Hello, ${profile.display_name}` : "Your account"}
      description="Your profile, security and marketplace readiness in one place."
    >
      <AccountPanel
        title="Get ready to trade"
        description="Complete your account while we prepare the marketplace for launch."
      >
        <div className="divide-y divide-border">
          {[
            {
              title: "Verify your email",
              detail: session?.user.email_confirmed_at
                ? "Email confirmed"
                : "Confirm your email to protect your account",
              to: "/verify-email",
            },
            {
              title: "Set up your profile",
              detail: profile ? `@${profile.handle}` : "Choose your name and public handle",
              to: "/account/profile",
            },
            {
              title: "Connect Roblox",
              detail: roblox
                ? `Connected as @${roblox.username}`
                : "Roblox connection is awaiting activation",
              to: "/account/connections",
            },
            {
              title: "Payment methods",
              detail: "Payment setup will open when our provider is connected",
              to: "/account/payments",
            },
          ].map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0"
            >
              <div>
                <p className="text-sm font-medium">{item.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">{item.detail}</p>
              </div>
              <span aria-hidden="true">→</span>
            </Link>
          ))}
        </div>
      </AccountPanel>
      <AccountPanel
        title="Marketplace opening soon"
        description="Account settings and support are available. Listings, bidding, deposits and payouts will open after payment and ownership verification services are connected."
      >
        <Link to="/support" className={buttonVariants({ variant: "outline" })}>
          Contact support
        </Link>
      </AccountPanel>
    </AccountLayout>
  );
}
