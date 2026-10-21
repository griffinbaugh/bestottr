import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { IS_DEMO } from "@/lib/app-mode";
import { RequireAccount } from "./AccountLayout";
import { buttonVariants } from "@/components/sb/ui";
export function MarketplaceGate({
  children,
  admin = false,
}: {
  children: ReactNode;
  admin?: boolean;
}) {
  if (IS_DEMO) return <>{children}</>;
  return (
    <RequireAccount admin={admin}>
      <div className="mx-auto max-w-xl px-5 py-20">
        <p className="eyebrow mb-3">Marketplace launch</p>
        <h1 className="text-3xl font-semibold tracking-tight">Trading opens soon</h1>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          We’re connecting listing verification, checkout and payouts. You can set up your account
          now; listings and transactions will open once those services are ready.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link to="/account" className={buttonVariants()}>
            Your account
          </Link>
          <Link to="/support" className={buttonVariants({ variant: "outline" })}>
            Contact support
          </Link>
          {admin && (
            <Link to="/admin/support" className={buttonVariants({ variant: "outline" })}>
              Support queue
            </Link>
          )}
        </div>
      </div>
    </RequireAccount>
  );
}
