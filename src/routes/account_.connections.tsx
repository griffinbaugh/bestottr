import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Link2, ExternalLink } from "lucide-react";
import { getAccountServices, startRobloxConnection } from "@/lib/account.functions";
import { useAuth } from "@/components/account/AuthProvider";
import { AccountLayout, AccountPanel, Message } from "@/components/account/AccountLayout";
import { Button, Badge } from "@/components/sb/ui";
export const Route = createFileRoute("/account_/connections")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Connected accounts — bestottr" }, { name: "robots", content: "noindex" }],
  }),
  component: Connections,
});
function Connections() {
  const { session, roblox } = useAuth();
  const [ready, setReady] = useState<boolean | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    void getAccountServices()
      .then((s) => setReady(s.roblox))
      .catch(() =>
        setError("Connection availability could not be checked. Please refresh to try again."),
      );
    const result = new URL(window.location.href).searchParams.get("roblox");
    if (result === "failed")
      setError(
        "Roblox could not be connected. You may have cancelled, used an expired request, or selected an account linked elsewhere. Please try again.",
      );
    if (result) window.history.replaceState({}, "", "/account/connections");
  }, []);
  async function connect() {
    if (!session) return;
    setBusy(true);
    setError("");
    try {
      const r = await startRobloxConnection({ data: { token: session.access_token } });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      window.location.assign(r.url);
    } catch {
      setError(
        "Roblox connection could not start. Confirm your email and security verification, then try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <AccountLayout
      title="Connected accounts"
      description="Link your creator identity with your bestottr account."
    >
      <AccountPanel
        title="Roblox"
        description="Connect directly through Roblox. We never ask for your Roblox password, cookies or API keys."
      >
        <div className="flex items-start gap-4">
          <div className="rounded-md bg-secondary p-3">
            <Link2 className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            {roblox ? (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">@{roblox.username}</p>
                  <Badge tone="brand">Identity confirmed</Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Roblox ID {roblox.roblox_user_id}
                </p>
                <a
                  className="mt-3 inline-flex items-center gap-1 text-sm underline underline-offset-4"
                  href={`https://www.roblox.com/users/${roblox.roblox_user_id}/profile`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  View Roblox profile
                  <ExternalLink className="h-3 w-3" />
                </a>
              </>
            ) : (
              <>
                <p className="text-sm font-medium">No Roblox account connected</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Confirm the account you use to own your experiences and communities.
                </p>
              </>
            )}
          </div>
        </div>
        <div className="mt-5 space-y-4">
          <Message error={error} />
          {ready === false && (
            <p className="rounded-md border border-border bg-secondary/40 p-3 text-sm text-muted-foreground">
              Roblox linking is being prepared and is not available yet. Your bestottr account is
              ready to use.
            </p>
          )}
          <Button
            variant="outline"
            disabled={busy || !ready || !session?.user.email_confirmed_at}
            onClick={() => void connect()}
          >
            {busy
              ? "Opening Roblox…"
              : roblox
                ? "Reconnect Roblox"
                : ready === null
                  ? "Checking availability…"
                  : "Connect Roblox"}
          </Button>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Connecting confirms your Roblox identity. Each listing must separately pass an ownership
            check before publication. To change the identity attached to an active transaction,
            contact support.
          </p>
        </div>
      </AccountPanel>
    </AccountLayout>
  );
}
