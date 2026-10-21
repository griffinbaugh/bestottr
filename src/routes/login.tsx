import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { safeReturnTo } from "@/lib/account";
import { AuthPage } from "@/components/account/AuthPage";
import { Field, Message } from "@/components/account/AccountLayout";
import { Button } from "@/components/sb/ui";
export const Route = createFileRoute("/login")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>): { returnTo?: string } => ({
    returnTo: safeReturnTo(s["returnTo"]),
  }),
  head: () => ({ meta: [{ title: "Sign in — bestottr" }, { name: "robots", content: "noindex" }] }),
  component: Login,
});
function Login() {
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const { returnTo } = Route.useSearch();
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) {
        setError(
          error.code === "email_not_confirmed"
            ? "Confirm your email before signing in. Use the verification page below to request another link."
            : "We couldn’t sign you in. Check your email and password, then try again.",
        );
        return;
      }
      if (data.session) window.location.assign(safeReturnTo(returnTo));
    } catch {
      setError("Sign-in is temporarily unavailable. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <AuthPage title="Welcome back" description="Sign in to your bestottr account.">
      <form onSubmit={submit} className="space-y-4">
        <Message error={error} />
        <Field label="Email address">
          <input
            className="field"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            maxLength={254}
          />
        </Field>
        <Field label="Password">
          <input
            className="field"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            maxLength={128}
          />
        </Field>
        <div className="text-right">
          <Link
            to="/forgot-password"
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Forgot password?
          </Link>
        </div>
        <Button className="w-full" type="submit" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </Button>
      </form>
      <p className="mt-6 text-sm text-muted-foreground">
        New here?{" "}
        <Link to="/signup" className="font-medium text-foreground underline underline-offset-4">
          Create an account
        </Link>
      </p>
      <Link
        to="/verify-email"
        className="mt-3 inline-block text-xs text-muted-foreground underline underline-offset-4"
      >
        Need to verify your email?
      </Link>
    </AuthPage>
  );
}
