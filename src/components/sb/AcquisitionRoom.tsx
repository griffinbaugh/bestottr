import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Check, CheckCircle2, Clock, Copy, Lock, RefreshCw, ShieldCheck, UserRound } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge, Button, Stat, buttonVariants } from "@/components/sb/ui";
import { ListingImage } from "@/components/sb/ListingImage";
import { useNow } from "@/components/sb/Countdown";
import type { Deal, Listing, State } from "@/lib/data";
import { usd } from "@/lib/format";
import { coverImage } from "@/lib/gallery";
import { DEMO_TARGET_URL, PROFILE_ERRORS, findDemoProfile, parseRobloxProfileUrl, profileUrlFor, type RobloxProfile } from "@/lib/roblox";
import { resolveRobloxUser } from "@/lib/roblox-transfer.functions";
import { actions } from "@/lib/store";
import { MONITORED, STATE_LABELS, canCheckNow, deadlineLevel, type ExperienceTransfer, type Party, type TargetAccount } from "@/lib/transfer";
import { cn } from "@/lib/utils";

export const SAFETY_COPY =
  "Your payment is not released to the seller until bestottr independently confirms the Roblox asset is owned by your locked destination account.";

const fmt = (ms: number) => new Date(ms).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" });
const ago = (ms: number | null, now: number) => (ms === null ? "Not yet" : now - ms < 60_000 ? `${Math.max(0, Math.round((now - ms) / 1000))}s ago` : `${Math.round((now - ms) / 60_000)}m ago`);
function left(ms: number) {
  if (ms <= 0) return "Expired";
  const s = Math.floor(ms / 1000), d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
  const p = (n: number) => String(n).padStart(2, "0");
  return d > 0 ? `${d}d ${p(h)}h ${p(m)}m` : `${p(h)}:${p(m)}:${p(x)}`;
}
const report = (r: { ok: boolean; error?: string }, success?: string) => (r.ok ? success && toast.success(success) : toast.error(r.error ?? "Action not allowed"));

function Avatar({ p }: { p: { username: string; avatarUrl: string | null } }) {
  return p.avatarUrl ? (
    <img src={p.avatarUrl} alt="" className="h-12 w-12 shrink-0 rounded-full bg-secondary object-cover" />
  ) : (
    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-secondary text-lg font-semibold uppercase">{p.username[0]}</span>
  );
}

export function TargetCard({ t, locked }: { t: TargetAccount; locked: boolean }) {
  const copy = (v: string) => { void navigator.clipboard?.writeText(v); toast.success("Copied"); };
  return (
    <div className="flex min-w-0 items-start gap-3 rounded-lg border border-border p-3">
      <Avatar p={t} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate font-medium">{t.displayName}</span>
          {locked && <Badge tone="brand"><Lock className="h-3 w-3" />Locked</Badge>}
        </div>
        <div className="truncate text-sm text-muted-foreground">@{t.username}</div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          <button className="num inline-flex items-center gap-1 text-muted-foreground hover:text-foreground" onClick={() => copy(t.userId)}>ID {t.userId}<Copy className="h-3 w-3" /></button>
          <button className="inline-flex min-w-0 items-center gap-1 text-muted-foreground hover:text-foreground" onClick={() => copy(t.profileUrl)}><span className="truncate break-all">{t.profileUrl.replace("https://", "")}</span><Copy className="h-3 w-3 shrink-0" /></button>
        </div>
      </div>
    </div>
  );
}

function TargetPicker({ d, s }: { d: Deal; s: State }) {
  const t = d.acquisition!;
  const resolve = useServerFn(resolveRobloxUser);
  const connected = s.roblox.connected && s.roblox.userId;
  const [mode, setMode] = useState<"connected" | "other">(connected ? "connected" : "other");
  const [url, setUrl] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const select = (p: RobloxProfile, source: TargetAccount["source"]) =>
    report(actions.selectTarget(d.id, { ...p, profileUrl: profileUrlFor(p.userId), source }));

  const useConnected = () => {
    if (!s.roblox.userId) return;
    const p = findDemoProfile(s.roblox.userId) ?? { userId: s.roblox.userId, username: s.roblox.username ?? "roblox", displayName: s.roblox.username ?? "Roblox user", avatarUrl: null };
    select(p, "connected");
  };
  const lookup = async () => {
    setErr(null);
    const r = parseRobloxProfileUrl(url);
    if (!r.ok) return setErr(PROFILE_ERRORS[r.reason]);
    const demo = findDemoProfile(r.userId);
    if (demo) return select(demo, "profile_url");
    setBusy(true);
    try {
      const res = await resolve({ data: { userId: r.userId } });
      if (res.ok) select(res.profile, "profile_url");
      else setErr(res.reason === "not_found" ? PROFILE_ERRORS.not_found : "Roblox profile lookup is unavailable right now. Try again shortly.");
    } catch { setErr("Roblox profile lookup is unavailable right now. Try again shortly."); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-4">
      <label className="block text-sm font-medium" htmlFor="target-mode">Transfer ownership to</label>
      <select id="target-mode" value={mode} onChange={(e) => setMode(e.target.value as "connected" | "other")} className="h-11 w-full rounded-md border border-input bg-card px-3 text-sm">
        <option value="connected" disabled={!connected}>My connected Roblox account{connected ? ` (@${s.roblox.username})` : " — not connected"}</option>
        <option value="other">Different Roblox account</option>
      </select>
      {mode === "connected" ? (
        connected ? <Button variant="outline" onClick={useConnected}><UserRound className="h-4 w-4" />Use @{s.roblox.username}</Button>
        : <p className="text-sm text-muted-foreground">Connect Roblox from the sell page, or choose a different account.</p>
      ) : (
        <div className="space-y-2">
          <div className="flex flex-col gap-2 sm:flex-row">
            <input aria-label="Roblox profile URL" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://www.roblox.com/users/123456/profile" className="h-11 min-w-0 flex-1 rounded-md border border-input bg-card px-3 text-sm" />
            <Button onClick={lookup} disabled={busy}>{busy ? "Looking up…" : "Look up"}</Button>
          </div>
          {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
          <p className="text-xs text-muted-foreground">Profile link only — never share passwords, cookies or .ROBLOSECURITY. Demo: <button className="underline" onClick={() => setUrl(DEMO_TARGET_URL)}>use demo alt account</button></p>
        </div>
      )}
      {t.target && (
        <div className="space-y-3">
          <TargetCard t={t.target} locked={false} />
          {t.targetConfirmed ? <Badge tone="brand"><Check className="h-3 w-3" />Destination confirmed</Badge> : (
            <Button onClick={() => report(actions.confirmTarget(d.id), "Destination confirmed")}>Confirm this is the destination account</Button>
          )}
        </div>
      )}
    </div>
  );
}

type Step = { label: string; done: boolean; active?: boolean; detail?: string };
function Checklist({ steps }: { steps: Step[] }) {
  return (
    <ol className="space-y-3">
      {steps.map((st) => (
        <li key={st.label} className="flex gap-3">
          <span className={cn("mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border", st.done ? "border-brand bg-brand text-brand-foreground" : st.active ? "border-foreground" : "border-input")}>
            {st.done ? <Check className="h-3 w-3" /> : st.active ? <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-foreground" /> : null}
          </span>
          <span className="min-w-0"><span className={cn("block text-sm font-medium", !st.done && !st.active && "text-muted-foreground")}>{st.label}</span>{st.detail && <span className="block text-xs text-muted-foreground">{st.detail}</span>}</span>
        </li>
      ))}
    </ol>
  );
}

function steps(t: ExperienceTransfer, role: Party): Step[] {
  const funded = t.fundedAt !== null;
  const started = t.transferStartedAt !== null || ["verifying_ownership", "ownership_confirmed", "payout_releasing", "completed"].includes(t.state);
  const confirmed = t.verification.confirmedAt !== null;
  const paid = t.state === "completed";
  const monitoring = MONITORED.includes(t.state);
  return role === "buyer"
    ? [
        { label: "Funds protected", done: funded, active: !funded, detail: "Held by the payment provider until Roblox ownership is confirmed" },
        { label: "Target Roblox account locked", done: t.targetLockedAt !== null, detail: t.target ? `@${t.target.username} · ID ${t.target.userId}` : "Choose before funding" },
        { label: "Seller transferring ownership", done: started || confirmed, active: funded && !started && monitoring },
        { label: "bestottr checking Roblox ownership automatically", done: confirmed, active: monitoring },
        { label: "Ownership confirmed", done: confirmed },
        { label: "Seller payment released", done: paid, active: t.state === "payout_releasing" },
      ]
    : [
        { label: "Buyer funds secured before transfer begins", done: funded, active: !funded, detail: funded ? "Do not transfer before this is checked" : "Wait — do not transfer yet" },
        { label: "Transfer to the exact destination account", done: started || confirmed, active: funded && monitoring },
        { label: "Automatic ownership verification", done: confirmed, active: monitoring },
        { label: "Payment released automatically", done: paid, active: t.state === "payout_releasing", detail: "Only after Roblox confirms ownership" },
      ];
}

export function AcquisitionRoom({ d, l, s }: { d: Deal; l: Listing; s: State }) {
  const t = d.acquisition!;
  const now = useNow() ?? t.events[0]?.at ?? 0;
  const [role, setRole] = useState<Party>(d.buyer === "you" ? "buyer" : "seller");
  const level = deadlineLevel(t, now);
  const group = t.asset.mode === "group";
  const terminal = ["completed", "refunded", "cancelled"].includes(t.state);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 md:px-6">
      <div className="flex flex-wrap items-center gap-4">
        <ListingImage image={coverImage(l)} alt="" className="h-16 w-28 shrink-0 rounded-md object-cover" />
        <div className="min-w-0 flex-1">
          <div className="eyebrow">Acquisition · #{d.id}</div>
          <h1 className="truncate text-2xl font-semibold tracking-tight">{l.title}</h1>
        </div>
        <Badge tone={t.state === "completed" ? "brand" : t.state === "manual_review" ? "live" : terminal ? "neutral" : "warning"}>{STATE_LABELS[t.state]}</Badge>
        <div className="flex rounded-md bg-secondary p-1 text-sm">
          {(["buyer", "seller"] as const).map((r) => (
            <button key={r} onClick={() => setRole(r)} className={cn("rounded px-3 py-1.5 capitalize", role === r ? "bg-card shadow-sm" : "text-muted-foreground")}>View as {r}</button>
          ))}
        </div>
      </div>

      <div className="mt-6 flex gap-3 rounded-lg border border-border bg-card p-4 text-sm">
        <ShieldCheck className="h-5 w-5 shrink-0 text-brand" />
        <p>{SAFETY_COPY} No party can manually force payout.</p>
      </div>

      <div className="surface mt-4 grid grid-cols-2 gap-5 p-5 md:grid-cols-4">
        <Stat label="Purchase price" value={usd(d.price)} />
        <Stat label="Platform fee (2.5%)" value={usd(d.fee)} />
        <Stat label="Buyer total" value={usd(d.price + d.fee)} />
        <Stat label="Funds" value={t.payment.status === "held" ? "Protected" : t.payment.status === "released" ? "Paid to seller" : t.payment.status === "refunded" ? "Refunded" : "Not funded"} />
      </div>

      {t.expiresAt !== null && MONITORED.includes(t.state) && (
        <div className={cn("mt-4 rounded-lg border p-4", level === "urgent" ? "border-destructive bg-destructive/10" : level === "warning" ? "border-warning bg-warning-soft" : "border-border bg-card")}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm font-medium">{level === "normal" ? <Clock className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                {level === "urgent" ? "Urgent: under 6 hours to complete transfer" : level === "warning" ? "Under 24 hours to complete transfer" : "Transfer deadline"}</div>
              <div className="mt-1 text-xs text-muted-foreground">Ends {fmt(t.expiresAt)} · automatic refund if ownership isn't confirmed by then</div>
            </div>
            <div className="num text-2xl font-semibold">{left(t.expiresAt - now)}</div>
          </div>
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-6">
          {t.state === "awaiting_funding" && (
            <section className="surface p-5">
              <h2 className="mb-4 text-lg font-semibold">{role === "buyer" ? "Choose the destination account" : "Waiting for buyer"}</h2>
              {role === "buyer" ? (
                <>
                  <TargetPicker d={d} s={s} />
                  <div className="mt-6 flex flex-wrap gap-2 border-t border-border pt-4">
                    <Button disabled={!t.targetConfirmed} onClick={() => report(actions.fundExperienceDeal(d.id), "Funds protected — destination locked")}>Pay {usd(d.price + d.fee)} (demo)</Button>
                    <Button variant="ghost" onClick={() => report(actions.cancelExperienceDeal(d.id, "buyer"), "Deal cancelled")}>Cancel deal</Button>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">The destination locks when funds are protected and can't be changed afterwards — a change requires cancelling for a refund.</p>
                </>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">The buyer must lock a destination account and fund the deal. Do not transfer anything yet.</p>
                  <Button variant="ghost" className="mt-4" onClick={() => report(actions.cancelExperienceDeal(d.id, "seller"), "Deal cancelled")}>Cancel deal</Button>
                </>
              )}
            </section>
          )}

          {t.target && t.state !== "awaiting_funding" && (
            <section className="surface p-5">
              <h2 className="mb-3 text-lg font-semibold">Destination Roblox account</h2>
              <TargetCard t={t.target} locked={t.targetLockedAt !== null} />
              {role === "seller" && MONITORED.includes(t.state) && (
                <div className="mt-4 rounded-md bg-secondary p-4 text-sm">
                  <div className="font-medium">How to transfer ({group ? "group-owned" : "user-owned"})</div>
                  {group ? (
                    <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted-foreground">
                      <li>Keep the experience in group {t.asset.groupId} — don't move it to another group.</li>
                      <li>Have @{t.target.username} join the group, then make them group <b>Owner</b> (Community settings → transfer ownership).</li>
                      <li>Admin, developer or high-rank roles do not count — only the group owner.</li>
                    </ol>
                  ) : (
                    <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted-foreground">
                      <li>Transfer universe {t.asset.universeId} (place {t.asset.placeId}) to user ID {t.target.userId}.</li>
                      <li>Transfer only this exact experience — a copy or different place won't verify.</li>
                    </ol>
                  )}
                  {t.state === "funded_locked" && (
                    <Button className="mt-4" variant="outline" onClick={() => report(actions.sellerMarkTransferStarted(d.id), "Marked as started — verification continues automatically")}>I started/completed the Roblox transfer</Button>
                  )}
                  <p className="mt-2 text-xs text-muted-foreground">This only updates status. Payment releases automatically after ownership is confirmed.</p>
                </div>
              )}
            </section>
          )}

          {t.fundedAt !== null && (
            <section className="surface p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">Ownership verification</h2>
                {MONITORED.includes(t.state) && (
                  <Button size="sm" variant="outline" disabled={!canCheckNow(t, now)} onClick={async () => report(await actions.runOwnershipCheck(d.id), "Checked Roblox")}>
                    <RefreshCw className="h-4 w-4" />Check now
                  </Button>
                )}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
                <Stat label="Last checked" value={ago(t.verification.lastCheckedAt, now)} />
                <Stat label="Next check" value={t.verification.nextCheckAt && MONITORED.includes(t.state) ? (t.verification.nextCheckAt <= now ? "Due now" : `in ${Math.ceil((t.verification.nextCheckAt - now) / 1000)}s`) : "—"} />
                <Stat label="Last result" value={t.verification.lastResult ?? "—"} />
              </div>
              {t.state === "ownership_confirmed" || t.state === "payout_releasing" || t.state === "completed" ? (
                <div className="mt-4 flex items-center gap-2 text-sm text-brand"><CheckCircle2 className="h-4 w-4" />Ownership confirmed{t.paidOutAt ? ` · seller paid ${fmt(t.paidOutAt)}` : " · releasing payout"}</div>
              ) : null}
              {t.state === "refunded" && <p className="mt-4 text-sm">Buyer refunded automatically{t.refundedAt ? ` on ${fmt(t.refundedAt)}` : ""}.</p>}
              {t.state === "refunding" && <p className="mt-4 text-sm text-warning">Refund pending with the payment provider — retrying automatically.</p>}
              {t.state === "manual_review" && (
                <p className="mt-4 text-sm">Roblox data was inconsistent, so funds stay protected while our team reviews. <Link to="/support" className="underline">Contact support</Link>.</p>
              )}
              {t.verification.evidence && (
                <details className="mt-4 text-xs text-muted-foreground">
                  <summary className="cursor-pointer">Verification evidence</summary>
                  <dl className="num mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 break-all">
                    <dt>Target</dt><dd>{t.verification.evidence.targetUserId}</dd>
                    <dt>Observed owner</dt><dd>{t.verification.evidence.observedOwnerId ?? "—"}</dd>
                    <dt>Universe / place</dt><dd>{t.verification.evidence.universeId} / {t.verification.evidence.placeId}</dd>
                    {t.asset.groupId && <><dt>Group</dt><dd>{t.asset.groupId}</dd></>}
                    <dt>Source</dt><dd>{t.verification.evidence.source}</dd>
                    <dt>Checked</dt><dd>{fmt(t.verification.evidence.checkedAt)}</dd>
                  </dl>
                </details>
              )}
            </section>
          )}

          {MONITORED.includes(t.state) && (
            <section className="surface space-y-4 p-5">
              <h2 className="text-lg font-semibold">Deadline & cancellation</h2>
              {!t.extensionUsed ? (
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <Button size="sm" variant="outline" disabled={t.extensionRequests[role]} onClick={() => report(actions.requestTransferExtension(d.id, role), "Extension approval recorded")}>
                    {t.extensionRequests[role] ? "You approved +24h" : "Approve one-time +24h extension"}
                  </Button>
                  <span className="text-muted-foreground">Buyer {t.extensionRequests.buyer ? "✓" : "—"} · Seller {t.extensionRequests.seller ? "✓" : "—"} · needs both</span>
                </div>
              ) : <p className="text-sm text-muted-foreground">One-time 24h extension used.</p>}
              {t.state === "funded_locked" ? (
                <Button size="sm" variant="ghost" onClick={() => report(actions.cancelExperienceDeal(d.id, role), "Cancelled — buyer refunded")}>Cancel and refund buyer</Button>
              ) : (
                <p className="text-sm text-muted-foreground">The transfer has started, so neither side can cancel early. Funds stay protected until ownership is confirmed or the deadline passes. Exceptional case? <Link to="/support" className="underline">Contact support</Link>.</p>
              )}
            </section>
          )}

          {t.asset.demo && !terminal && t.fundedAt !== null && (
            <section className="rounded-xl border border-dashed border-warning bg-warning-soft p-4">
              <div className="text-sm font-semibold">DEV / DEMO ONLY — simulate Roblox</div>
              <p className="mt-1 text-xs text-muted-foreground">Changes the simulated Roblox data the verifier reads. Not available in production.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" variant="demo" onClick={() => actions.demoSimulate(d.id, "target")}>Correct transfer to destination</Button>
                <Button size="sm" variant="demo" onClick={() => actions.demoSimulate(d.id, "wrong_user")}>Transfer to wrong user</Button>
                {group && <Button size="sm" variant="demo" onClick={() => actions.demoSimulate(d.id, "group_admin_only")}>Make buyer group admin only</Button>}
                <Button size="sm" variant="demo" onClick={() => actions.demoSimulate(d.id, "outage")}>Roblox API outage</Button>
                <Button size="sm" variant="demo" onClick={() => actions.demoSimulate(d.id, "restore")}>End outage</Button>
                <Button size="sm" variant="demo" onClick={() => actions.demoSimulate(d.id, "expire")}>Fast-forward to deadline</Button>
              </div>
            </section>
          )}
        </div>

        <aside className="min-w-0 space-y-6">
          <section className="surface p-5">
            <h3 className="mb-4 font-semibold">{role === "buyer" ? "Your checklist" : "Seller checklist"}</h3>
            <Checklist steps={steps(t, role)} />
          </section>
          <section className="surface p-5">
            <h3 className="mb-3 font-semibold">Activity</h3>
            <ul className="space-y-3 text-sm">
              {t.events.map((e, i) => (
                <li key={i} className="min-w-0"><div className="break-words">{e.text}</div><div className="text-xs text-muted-foreground">{fmt(e.at)}</div></li>
              ))}
            </ul>
          </section>
          <Link to="/dashboard" className={buttonVariants({ variant: "outline", className: "w-full" })}>Back to dashboard</Link>
        </aside>
      </div>
    </div>
  );
}
