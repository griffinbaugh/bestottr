import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { MfaGate } from "./MfaChallenge";
import { useAuth } from "./AuthProvider";
import { buttonVariants, Button } from "@/components/sb/ui";
import {
  Check,
  UserRound,
  ShieldCheck,
  Link2,
  CreditCard,
  Landmark,
  Bell,
  ArrowUpRight,
} from "lucide-react";
const links = [
  { to: "/account", label: "Overview", icon: UserRound },
  { to: "/account/profile", label: "Public profile", icon: UserRound },
  { to: "/account/security", label: "Login & security", icon: ShieldCheck },
  { to: "/account/verification", label: "Verification", icon: Check },
  { to: "/account/connections", label: "Connected accounts", icon: Link2 },
  { to: "/account/payments", label: "Payment methods", icon: CreditCard },
  { to: "/account/payouts", label: "Deposits & payouts", icon: Landmark },
  { to: "/account/notifications", label: "Notifications", icon: Bell },
] as const;
export function RequireAccount({
  children,
  admin = false,
}: {
  children: ReactNode;
  admin?: boolean;
}) {
  const { session, loading, isAdmin, profile, accountError } = useAuth();
  if (loading)
    return (
      <div className="mx-auto max-w-lg px-5 py-20 text-sm text-muted-foreground" role="status">
        Loading your account…
      </div>
    );
  if (!session)
    return (
      <div className="mx-auto max-w-lg px-5 py-20">
        <h1 className="text-2xl font-semibold">Sign in to continue</h1>
        <p className="mt-3 text-muted-foreground">
          Your account keeps your profile, verification and activity together.
        </p>
        <div className="mt-6 flex gap-3">
          <Link
            to="/login"
            search={{
              returnTo: typeof window !== "undefined" ? window.location.pathname : "/account",
            }}
            className={buttonVariants()}
          >
            Sign in
          </Link>
          <Link to="/signup" className={buttonVariants({ variant: "outline" })}>
            Create account
          </Link>
        </div>
      </div>
    );
  if (admin && !isAdmin)
    return (
      <div className="mx-auto max-w-lg px-5 py-20">
        <h1 className="text-xl font-semibold">Staff access required</h1>
        <p className="mt-2 text-muted-foreground">
          This area is available to authorized staff only.
        </p>
        {!profile && !accountError && (
          <p className="mt-2 text-sm" role="status">
            Checking your permissions…
          </p>
        )}
        <Link to="/account" className="mt-5 inline-block underline">
          Back to your account
        </Link>
      </div>
    );
  return <MfaGate key={session.user.id}>{children}</MfaGate>;
}
export function AccountLayout({
  children,
  title,
  description,
}: {
  children: ReactNode;
  title: string;
  description: string;
}) {
  const { profile, session, accountError, refresh } = useAuth();
  return (
    <RequireAccount>
      <div className="mx-auto max-w-7xl px-4 py-8 md:px-6 md:py-12">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow mb-2">Your account</p>
            <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
            <p className="mt-2 text-sm text-muted-foreground">{description}</p>
          </div>
          {profile && (
            <Link
              to="/user/$handle"
              params={{ handle: profile.handle }}
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
            >
              View public profile
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          )}
        </div>
        <div className="grid items-start gap-8 md:grid-cols-[205px_minmax(0,1fr)]">
          <aside className="overflow-x-auto">
            <nav aria-label="Account settings" className="flex gap-1 md:flex-col">
              {links.map(({ to, label, icon: Icon }) => (
                <Link
                  key={to}
                  to={to}
                  activeOptions={{ exact: true }}
                  className="flex shrink-0 items-center gap-2.5 rounded-md px-3 py-2.5 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground"
                  activeProps={{ className: "bg-secondary text-foreground font-medium" }}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </Link>
              ))}
            </nav>
            <p className="mt-5 hidden break-all px-3 text-xs text-muted-foreground md:block">
              {session?.user.email}
            </p>
          </aside>
          <div className="min-w-0 max-w-3xl">
            {accountError && (
              <div role="alert" className="mb-5 rounded-md border border-warning p-4 text-sm">
                {accountError}
                <Button variant="outline" size="sm" className="ml-3" onClick={() => void refresh()}>
                  Retry
                </Button>
              </div>
            )}
            {children}
          </div>
        </div>
      </div>
    </RequireAccount>
  );
}
export function AccountPanel({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="surface mb-5 p-5 md:p-6">
      <h2 className="text-base font-semibold">{title}</h2>
      {description && (
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{description}</p>
      )}
      <div className="mt-5">{children}</div>
    </section>
  );
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-2 block font-medium">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}
export function Message({ error, success }: { error?: string | null; success?: string | null }) {
  return (
    <>
      {error && (
        <p
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"
        >
          {error}
        </p>
      )}
      {success && (
        <p role="status" className="rounded-md border border-border bg-secondary p-3 text-sm">
          {success}
        </p>
      )}
    </>
  );
}
