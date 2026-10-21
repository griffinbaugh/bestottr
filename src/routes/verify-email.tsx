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
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: email.trim(),
        options: { emailRedirectTo: authCallback() },
      });
      if (error) {
        setError("We couldn’t send another link. Check the address and try again shortly.");
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
          : "Open the confirmation link from bestottr to verify your email. You can use this page to request a fresh link."
      }
    >
      {session?.user.email_confirmed_at ? (
        <Link to="/account" className={buttonVariants()}>
          Continue to your account
        </Link>
      ) : (
        <>
          <Message
            error={error}
            success={
              sent ? "If confirmation is needed for this address, a new link is on its way." : null
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
            Check your spam folder. Older links may expire after you request a new one.
          </p>
          <Link to="/login" className="mt-4 inline-block text-sm underline">
            Back to sign in
          </Link>
        </>
      )}
    </AuthPage>
  );
}
