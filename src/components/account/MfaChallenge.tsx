import { useState, useEffect, type FormEvent, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/sb/ui";
import { Field, Message } from "./AccountLayout";
export function MfaGate({ children }: { children: ReactNode }) {
  const [factor, setFactor] = useState<string | null>(null),
    [checking, setChecking] = useState(true),
    [error, setError] = useState(""),
    [code, setCode] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    void supabase.auth.mfa
      .getAuthenticatorAssuranceLevel()
      .then(async ({ data, error }) => {
        if (error) throw error;
        if (data?.nextLevel === "aal2" && data.currentLevel !== "aal2") {
          const r = await supabase.auth.mfa.listFactors();
          if (r.error) throw r.error;
          const f = r.data.totp.find((f) => f.status === "verified");
          if (!f) throw new Error("No supported authenticator was found. Contact support.");
          if (active) setFactor(f.id);
        }
        if (active) setChecking(false);
      })
      .catch(() => {
        if (active) {
          setError("We couldn’t verify your security settings. Refresh the page to try again.");
          setChecking(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!factor) return;
    setBusy(true);
    setError("");
    try {
      const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor, code });
      if (error) {
        setError(
          "That code could not be verified. Enter the current code from your authenticator.",
        );
        return;
      }
      window.location.reload();
    } catch {
      setError("Verification failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  if (checking)
    return (
      <p className="px-5 py-12 text-sm text-muted-foreground" role="status">
        Checking account security…
      </p>
    );
  if (factor)
    return (
      <div className="mx-auto max-w-sm px-5 py-16">
        <h1 className="text-2xl font-semibold">Two-step verification</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Enter the six-digit code from your authenticator app.
        </p>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <Message error={error} />
          <Field label="Authentication code">
            <input
              autoComplete="one-time-code"
              className="field num"
              inputMode="numeric"
              pattern="[0-9]{6}"
              minLength={6}
              maxLength={6}
              required
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            />
          </Field>
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Verifying…" : "Verify and continue"}
          </Button>
        </form>
      </div>
    );
  if (error)
    return (
      <div className="mx-auto max-w-lg px-5 py-16">
        <Message error={error} />
        <Button className="mt-4" variant="outline" onClick={() => window.location.reload()}>
          Try again
        </Button>
      </div>
    );
  return <>{children}</>;
}
