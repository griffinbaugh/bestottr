import { useServerFn } from "@tanstack/react-start";
import { ExternalLink as LinkIcon, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { Listing } from "@/lib/data";
import { communityUrl, gameUrl } from "@/lib/community";
import { compact } from "@/lib/format";
import { demoFactsForListing, likeRatio, REFRESH_COOLDOWN_MS, type LiveCommunityFacts, type LiveExperienceFacts } from "@/lib/roblox-live";
import { getLiveCommunityFacts, getLiveExperienceFacts } from "@/lib/roblox-live.functions";
import { Button, Stat } from "./ui";
import { ExternalLink } from "./SellerLink";
import { RobloxVerifiedBadge } from "./CommunityHero";

const memo = new Map<string, unknown>();
const when = (ms: number) => new Date(ms).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const date = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—");
const n = (v: number | null) => (v === null ? "—" : compact(v));

/** Server-fetched facts with a client memo, "Last updated" and a rate-limited refresh. */
function useLive<T extends { fetchedAt: number }>(key: string | null, load: (force: boolean) => Promise<T>, initial: T | null) {
  const [facts, setFacts] = useState<T | null>(() => (key ? ((memo.get(key) as T | undefined) ?? initial) : initial));
  const [busy, setBusy] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(0);
  const run = useCallback(async (force: boolean) => {
    if (!key) return;
    setBusy(true);
    try {
      const v = await load(force);
      memo.set(key, v);
      setFacts(v);
    } catch { /* keep previous facts; section shows stale */ } finally { setBusy(false); }
  }, [key, load]);
  useEffect(() => { if (key && !memo.has(key)) void run(false); }, [key, run]);
  const refresh = () => { setLastRefresh(Date.now()); void run(true); };
  const canRefresh = !busy && Date.now() - lastRefresh >= REFRESH_COOLDOWN_MS;
  return { facts, busy, refresh, canRefresh };
}

function Header({ fetchedAt, source, unavailable, busy, canRefresh, refresh }: { fetchedAt: number | null; source: string | null; unavailable: boolean; busy: boolean; canRefresh: boolean; refresh: () => void }) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 className="font-semibold">Live Roblox data</h2>
        <p className="text-xs text-muted-foreground" data-testid="live-updated">
          {unavailable ? "Roblox data unavailable right now — showing the last saved snapshot." : fetchedAt ? `From ${source === "demo" ? "demo Roblox data" : "Roblox public APIs"} · Last updated ${when(fetchedAt)}` : "Loading…"}
        </p>
      </div>
      <Button size="sm" variant="outline" disabled={!canRefresh} onClick={refresh}><RefreshCw className={busy ? "h-4 w-4 animate-spin" : "h-4 w-4"} />Refresh Roblox data</Button>
    </div>
  );
}

export function ExperienceFactsView({ f }: { f: LiveExperienceFacts }) {
  const ratio = likeRatio(f);
  return (
    <div data-testid="experience-live-facts">
      <div className="grid grid-cols-2 gap-x-5 gap-y-5 sm:grid-cols-4">
        <Stat label="Roblox name" value={<span className="text-base">{f.name ?? "—"}</span>} />
        <Stat label="Visits" value={n(f.visits)} />
        <Stat label="Favorites" value={n(f.favorites)} />
        <Stat label="Playing now" value={n(f.playing)} />
        <Stat label="Like ratio" value={ratio === null ? "—" : `${Math.round(ratio * 100)}%`} hint={f.upVotes !== null ? `${compact(f.upVotes)} up · ${compact(f.downVotes ?? 0)} down` : undefined} />
        <Stat label="Max players" value={f.maxPlayers ?? "—"} />
        <Stat label="Created" value={<span className="text-base">{date(f.created)}</span>} />
        <Stat label="Updated" value={<span className="text-base">{date(f.updated)}</span>} />
      </div>
      <dl className="num mt-5 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 border-t border-border pt-4 text-sm">
        <dt className="text-muted-foreground">Creator</dt><dd className="min-w-0 break-words">{f.creatorName ?? "—"} {f.creatorType && <span className="text-muted-foreground">({f.creatorType === "Group" ? "Community" : "User"} · ID {f.creatorId})</span>}</dd>
        <dt className="text-muted-foreground">Place / universe</dt><dd className="break-all">{f.placeId} / {f.universeId ?? "—"}</dd>
        <dt className="text-muted-foreground">Genre</dt><dd>{f.genre ?? "—"}</dd>
      </dl>
      {f.group && (
        <div className="mt-4 rounded-md border border-border p-3 text-sm" data-testid="owning-community">
          <div className="flex flex-wrap items-center gap-2 font-medium">Owning Community: {f.group.name || `#${f.group.groupId}`} {f.group.verified && <RobloxVerifiedBadge />}</div>
          <div className="mt-0.5 text-xs text-muted-foreground">ID {f.group.groupId} · {f.group.memberCount === null ? "—" : compact(f.group.memberCount)} members</div>
        </div>
      )}
    </div>
  );
}

export function LiveExperienceData({ l }: { l: Listing }) {
  const placeId = l.experience?.placeId ?? null;
  const fetchFacts = useServerFn(getLiveExperienceFacts);
  const seeded = placeId ? null : demoFactsForListing(l, l.createdAt);
  const load = useCallback((force: boolean) => (placeId ? fetchFacts({ data: { placeId, force } }) : Promise.resolve(demoFactsForListing(l, Date.now()))), [placeId, fetchFacts, l]);
  const { facts, busy, refresh, canRefresh } = useLive<LiveExperienceFacts>(`exp:${placeId ?? l.id}`, load, seeded);
  const groupId = facts?.group?.groupId ?? null;
  const gamePlace = facts?.placeId ?? placeId;
  return (
    <section className="surface p-5" data-testid="live-roblox-data">
      <Header fetchedAt={facts?.fetchedAt ?? null} source={facts?.source ?? null} unavailable={!!facts?.unavailable} busy={busy} canRefresh={canRefresh} refresh={refresh} />
      {facts && !facts.unavailable ? <ExperienceFactsView f={facts} /> : facts?.unavailable ? <p className="text-sm text-muted-foreground">Listing details remain available; live facts will return when Roblox responds.</p> : null}
      <div className="mt-4 flex flex-wrap gap-4">
        {gamePlace && <ExternalLink href={gameUrl(gamePlace)}><LinkIcon className="h-4 w-4" />View game on Roblox</ExternalLink>}
        {groupId && <ExternalLink href={communityUrl(groupId)}><LinkIcon className="h-4 w-4" />View community on Roblox</ExternalLink>}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">Objective public data from Roblox, shown for information. Ownership is verified separately.</p>
    </section>
  );
}

export function LiveCommunityData({ l }: { l: Listing }) {
  const c = l.community!;
  const fetchFacts = useServerFn(getLiveCommunityFacts);
  const load = useCallback((force: boolean) => fetchFacts({ data: { groupId: c.groupId, force } }) as Promise<LiveCommunityFacts>, [c.groupId, fetchFacts]);
  const snapshot: LiveCommunityFacts = { ...c, unavailable: false };
  const { facts, busy, refresh, canRefresh } = useLive<LiveCommunityFacts>(`grp:${c.groupId}`, load, snapshot);
  // Unknown/unavailable live data falls back to the verified snapshot saved with the listing.
  const f = facts && !facts.unavailable && facts.name ? facts : snapshot;
  return (
    <section className="surface p-5" data-testid="live-roblox-data">
      <Header fetchedAt={f.fetchedAt} source={f.source} unavailable={!!facts?.unavailable} busy={busy} canRefresh={canRefresh} refresh={refresh} />
      <div className="grid grid-cols-2 gap-x-5 gap-y-5 sm:grid-cols-4">
        <Stat label="Roblox name" value={<span className="text-base">{f.name}</span>} />
        <Stat label="Members" value={n(f.memberCount)} />
        <Stat label="Community ID" value={<span className="num text-base">{f.groupId}</span>} />
        <Stat label="Roblox verified" value={<span className="text-base">{f.verified ? "Yes" : "No"}</span>} />
      </div>
      <dl className="num mt-5 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 border-t border-border pt-4 text-sm">
        <dt className="text-muted-foreground">Current owner</dt><dd className="min-w-0 break-words">@{f.ownerUsername || "—"} <span className="text-muted-foreground">(ID {f.ownerUserId || "—"})</span></dd>
        <dt className="text-muted-foreground">Banner</dt><dd>{f.bannerUrl ? "Provided" : "None on Roblox"}</dd>
      </dl>
      <div className="mt-4"><ExternalLink href={communityUrl(c.groupId)}><LinkIcon className="h-4 w-4" />View on Roblox</ExternalLink></div>
    </section>
  );
}
