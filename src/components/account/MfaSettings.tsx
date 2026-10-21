import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AccountPanel, Field, Message } from "./AccountLayout";
import { Button } from "@/components/sb/ui";
export function MfaSettings() {
  const [factors, setFactors] = useState<{ id: string; friendly_name?: string }[]>([]),
    [loading, setLoading] = useState(true),
    [setup, setSetup] = useState<{ id: string; qr: string; secret: string } | null>(null),
    [code, setCode] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [success, setSuccess] = useState("");
  async function load() {
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) throw error;
    setFactors(data.totp.filter((f) => f.status === "verified"));
    setLoading(false);
  }
  useEffect(() => {
    void load().catch(() => {
      setLoading(false);
      setError("Authenticator settings could not be loaded. Refresh before making changes.");
    });
  }, []);
  async function enroll() {
    setBusy(true);
    setError("");
    try {
      const existing = await supabase.auth.mfa.listFactors();
      if (existing.error) throw existing.error;
      for (const f of existing.data.all.filter(
        (f) => f.factor_type === "totp" && f.status === "unverified",
      )) {
        const r = await supabase.auth.mfa.unenroll({ factorId: f.id });
        if (r.error) throw r.error;
      }
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "BestOttr authenticator",
        issuer: "BestOttr",
      });
      if (error) throw error;
      setSetup({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
    } catch {
      setError("Authenticator setup could not start. Try again.");
    } finally {
      setBusy(false);
    }
  }
  async function verify(e: FormEvent) {
    e.preventDefault();
    if (!setup) return;
    setBusy(true);
    setError("");
    try {
      const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: setup.id, code });
      if (error) {
        setError("The code did not match. Enter the current code from your app.");
        return;
      }
      setSetup(null);
      setCode("");
      setSuccess("Two-step verification is enabled.");
      await load();
    } catch {
      setError("Verification could not be completed.");
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (!window.confirm("Remove your authenticator? Your account will use password-only sign-in."))
      return;
    setBusy(true);
    setError("");
    try {
      const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (error || data?.currentLevel !== "aal2")
        throw new Error("Complete two-step verification first.");
      for (const f of factors) {
        const { error } = await supabase.auth.mfa.unenroll({ factorId: f.id });
        if (error) throw error;
      }
      await load();
      setSuccess("Authenticator removed.");
    } catch {
      setError("Complete two-step verification before removing the authenticator.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <AccountPanel
      title="Two-step verification"
      description="Use an authenticator app to add a second sign-in step."
    >
      <div className="space-y-4">
        <Message error={error} success={success} />
        {loading ? (
          <p className="text-sm text-muted-foreground" role="status">
            Loading security settings…
          </p>
        ) : factors.length ? (
          <>
            <p className="text-sm">An authenticator is enabled.</p>
            <Button variant="outline" disabled={busy} onClick={() => void remove()}>
              Remove authenticator
            </Button>
          </>
        ) : setup ? (
          <form onSubmit={verify} className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Scan the QR code with your authenticator app. Keep the setup key private.
            </p>
            <img
              alt="Authenticator setup QR code"
              src={
                setup.qr.startsWith("data:")
                  ? setup.qr
                  : `data:image/svg+xml;charset=utf-8,${encodeURIComponent(setup.qr)}`
              }
              className="h-44 w-44 rounded-md bg-white p-3"
            />
            <details className="text-sm">
              <summary className="cursor-pointer">Enter setup key manually</summary>
              <code className="mt-3 block break-all rounded-md bg-secondary p-3">
                {setup.secret}
              </code>
            </details>
            <Field label="Authentication code">
              <input
                className="field num"
                autoComplete="one-time-code"
                inputMode="numeric"
                pattern="[0-9]{6}"
                minLength={6}
                maxLength={6}
                required
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              />
            </Field>
            <Button type="submit" disabled={busy}>
              Verify and enable
            </Button>
          </form>
        ) : (
          <Button variant="outline" onClick={() => void enroll()} disabled={busy || !!error}>
            {busy ? "Starting…" : "Set up authenticator"}
          </Button>
        )}
      </div>
    </AccountPanel>
  );
}
