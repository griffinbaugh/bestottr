import { NotificationBell } from "@/components/account/Notifications";
import { Link } from "@tanstack/react-router";
import lockup from "@/assets/bestottr-primary-white.png";
import {
  BadgeCheck,
  Heart,
  LifeBuoy,
  ChevronDown,
  UserRound,
  Settings,
  ShieldCheck,
  CreditCard,
  Landmark,
  Link2,
  LogOut,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/account/AuthProvider";
import { initials } from "@/lib/account";
import { IS_DEMO } from "@/lib/app-mode";
import { useAppState } from "@/lib/store";
import { buttonVariants } from "./ui";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
const navigation = [
  { to: "/browse", label: "Marketplace", search: { q: "" } },
  { to: "/sell", label: "Sell", search: {} },
  { to: "/dashboard", label: "Buying", search: {} },
  { to: "/seller", label: "Selling", search: {} },
] as const;
export function SiteHeader() {
  const { session, loading, profile, roblox, isAdmin, signOut } = useAuth();
  const demo = useAppState();
  const nav = isAdmin
    ? [...navigation, { to: "/admin" as const, label: "Admin", search: {} }]
    : navigation;
  const username = IS_DEMO && demo.roblox.connected ? demo.roblox.username : roblox?.username;
  const name = profile?.display_name || "Your account";
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 md:gap-6 md:px-6">
        <Link to="/" className="mr-2 flex shrink-0 items-center py-2" aria-label="bestottr home">
          <img
            src={lockup}
            alt="bestottr"
            width={591}
            height={187}
            className="h-auto w-[118px] object-contain lg:w-[140px]"
          />
        </Link>
        <nav aria-label="Main navigation" className="hidden items-center gap-1 lg:flex">
          {nav.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              search={n.search}
              className="rounded-md px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
              activeProps={{ className: "text-foreground bg-secondary" }}
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          {!IS_DEMO && !loading && <NotificationBell />}
          <Link
            to="/dashboard"
            search={{ tab: "watchlist" }}
            className="hidden h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground sm:flex"
            aria-label="Watchlist"
          >
            <Heart className="h-4 w-4" />
          </Link>
          <Link
            to="/support"
            className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="Help & support"
          >
            <LifeBuoy className="h-4 w-4" />
          </Link>
          {username && (
            <span className="hidden items-center gap-1 rounded-full bg-brand-soft px-2.5 py-1 text-xs font-medium text-brand xl:inline-flex">
              <BadgeCheck className="h-3.5 w-3.5" />@{username}
            </span>
          )}
          {loading ? (
            <span
              className="h-8 w-8 animate-pulse rounded-full bg-secondary"
              aria-label="Loading account"
            />
          ) : session ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="ml-1 flex items-center gap-2 rounded-full p-1 pr-2 text-sm hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label="Open account menu"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-xs font-semibold">
                    {initials(name)}
                  </span>
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel>
                  <p className="truncate text-sm font-medium">{name}</p>
                  <p className="mt-1 truncate text-xs font-normal text-muted-foreground">
                    {session.user.email}
                  </p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/account">
                    <UserRound />
                    Your account
                  </Link>
                </DropdownMenuItem>
                {profile && (
                  <DropdownMenuItem asChild>
                    <Link to="/user/$handle" params={{ handle: profile.handle }}>
                      <UserRound />
                      View public profile
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem asChild>
                  <Link to="/account/profile">
                    <Settings />
                    Account settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/account/verification">
                    <ShieldCheck />
                    Verification
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/account/connections">
                    <Link2 />
                    Connected accounts
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/account/payments">
                    <CreditCard />
                    Payment methods
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/account/payouts">
                    <Landmark />
                    Deposits & payouts
                  </Link>
                </DropdownMenuItem>
                {isAdmin && (
                  <DropdownMenuItem asChild>
                    <Link to="/admin/support">
                      <ShieldCheck />
                      Support admin
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={() =>
                    void signOut().catch(() => toast.error("Sign-out failed. Please try again."))
                  }
                >
                  <LogOut />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <>
              <Link
                to="/login"
                search={{ returnTo: "/account" }}
                className="hidden px-3 py-2 text-sm text-muted-foreground hover:text-foreground sm:inline-flex"
              >
                Sign in
              </Link>
              <Link to="/signup" className={buttonVariants({ size: "sm" })}>
                Create account
              </Link>
            </>
          )}
        </div>
      </div>
      <nav
        aria-label="Mobile navigation"
        className="flex gap-1 overflow-x-auto border-t border-border px-3 py-1.5 lg:hidden"
      >
        {nav.map((n) => (
          <Link
            key={n.to}
            to={n.to}
            search={n.search}
            className="shrink-0 rounded-md px-3 py-2 text-sm text-muted-foreground"
            activeProps={{ className: "text-foreground bg-secondary" }}
          >
            {n.label}
          </Link>
        ))}
        {!session && !loading && (
          <Link
            to="/login"
            search={{ returnTo: "/account" }}
            className="shrink-0 rounded-md px-3 py-2 text-sm text-muted-foreground sm:hidden"
          >
            Sign in
          </Link>
        )}
      </nav>
    </header>
  );
}
