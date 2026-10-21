import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { authCallback } from "@/lib/account";
import { AuthPage } from "@/components/account/AuthPage";
import { Field, Message } from "@/components/account/AccountLayout";
import { Button } from "@/components/sb/ui";
export const Route = createFileRoute("/forgot-password")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Reset your password — bestottr" }, { name: "robots", content: "noindex" }],
  }),
  component: Forgot,
});
function Forgot() {
  const [email, setEmail] = useState(""),
    [busy, setBusy] = useState(false),
    [sent, setSent] = useState(false),
    [error, setError] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: authCallback() + "?next=/reset-password",
      });
      if (error) {
        setError("We couldn’t send a reset link. Wait a moment and try again.");
        return;
      }
      setSent(true);
    } catch {
      setError("Please try again in a moment.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <AuthPage
      title="Forgot your password?"
      description="We’ll send a secure link to help you get back in."
    >
      <Message
        error={error}
        success={
          sent
            ? "If an account exists for this address, a password-reset link is on its way. Check your inbox and spam folder."
            : null
        }
      />
      {!sent && (
        <form onSubmit={submit} className="mt-4 space-y-4">
          <Field label="Email address">
            <input
              className="field"
              type="email"
              autoComplete="email"
              required
              maxLength={254}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Sending…" : "Send reset link"}
          </Button>
        </form>
      )}
      <Link to="/login" className="mt-6 inline-block text-sm underline underline-offset-4">
        Back to sign in
      </Link>
    </AuthPage>
  );
}
