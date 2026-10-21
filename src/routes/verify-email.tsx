import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { authCallback } from "@/lib/account";
import { useAuth } from "@/components/account/AuthProvider";
import { AuthPage } from "@/components/account/AuthPage";
import { Field, Message } from "@/components/account/AccountLayout";
import { Button, buttonVariants } from "@/components/sb/ui";
export const Route = createFileRoute("/verify-email")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Verify your email — bestottr" }, { name: "robots", content: "noindex" }],
  }),
  component: Verify,
});
function Verify() {
  const { session } = useAuth();
  const [email, setEmail] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [sent, setSent] = useState(false),
    [cooldown, setCooldown] = useState(0);
  useEffect(() => {
    setEmail(session?.user.email ?? sessionStorage.getItem("bestottr-verification-email") ?? "");
  }, [session]);
  useEffect(() => {
    if (!cooldown) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);
  async function resend(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setSent(false);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: email.trim(),
        options: { emailRedirectTo: authCallback() },
      });
      if (error) {
        setError(
          error.status === 429 ||
            error.code === "over_email_send_rate_limit" ||
            error.code === "over_request_rate_limit"
            ? "Too many email requests. Wait a few minutes before trying again."
            : "We couldn’t request another link. Please try again shortly or contact support.",
        );
        if (error.status === 429) setCooldown(60);
        return;
      }
      setSent(true);
      setCooldown(60);
    } catch {
      setError("Please try again shortly.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <AuthPage
      title={session?.user.email_confirmed_at ? "Email verified" : "Check your inbox"}
      description={
        session?.user.email_confirmed_at
          ? "Your email address is confirmed."
          : "Open the confirmation link from bestottr, or try signing in if no email arrives."
      }
    >
      {session?.user.email_confirmed_at ? (
        <Link to="/account" className={buttonVariants()}>
          Continue to your account
        </Link>
      ) : (
        <>
          <div className="mb-6 rounded-lg border border-border p-4">
            <h2 className="text-sm font-medium">No confirmation email?</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Your email provider may have opened the link automatically and verified your account
              already. Try signing in with the email and password you chose—you may not need to
              wait.
            </p>
            <Link to="/login" className={buttonVariants({ className: "mt-4 w-full" })}>
              Try signing in
            </Link>
            <p className="mt-3 text-xs text-muted-foreground">
              If sign-in says your email still needs confirmation, return here to request a new
              link.
            </p>
          </div>
          <Message
            error={error}
            success={
              sent
                ? "If your account still needs confirmation, we’ve requested a new link. Already verified accounts won’t receive another signup email—try signing in if nothing arrives."
                : null
            }
          />
          <form onSubmit={resend} className="mt-4 space-y-4">
            <Field label="Email address">
              <input
                className="field"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                maxLength={254}
              />
            </Field>
            <Button
              type="submit"
              variant="outline"
              className="w-full"
              disabled={busy || cooldown > 0}
            >
              {busy
                ? "Sending…"
                : cooldown
                  ? `Send again in ${cooldown}s`
                  : "Resend confirmation link"}
            </Button>
          </form>
          <p className="mt-5 text-xs text-muted-foreground">
            Check your spam or junk folder. Confirmed accounts do not receive another signup email.
            If you receive a link, use only the newest one in the browser where you signed up.
          </p>
          <Link to="/login" className="mt-4 inline-block text-sm underline">
            Back to sign in
          </Link>
        </>
      )}
    </AuthPage>
  );
}
