import { IS_DEMO, requireDemo } from "./app-mode";
import { editCommunity, editExperience, type CommunityChanges, type ExperienceChanges } from "./listing-edit";
import { useSyncExternalStore } from "react";
import { DD_ITEMS, FILE_STAGES, ME, TRANSFER_ITEMS, seedState, type AdminItem, type Deal, type Listing, type State } from "./data";
import { applyPurchase, isSoldOut } from "./inventory";
import { buyerPremium, minNextBid } from "./pricing";
import { DEMO_USER_ID, DEMO_USERNAME, findDemoProfile, profileUrlFor } from "./roblox";
import { assetFromListing, initialWorldEntry, observeDemo, type DemoWorldEntry } from "./roblox-ownership";
import {
  applyCheck, canCheckNow, cancelTransfer, chooseTarget, confirmTarget, createTransfer, fundTransfer, markTransferStarted,
  requestExtension, tick, MONITORED, type CheckOutcome, type ExperienceTransfer, type Party, type StepResult, type TargetAccount,
} from "./transfer";
import { lookupLiveCommunityOwnership, lookupLiveOwnership } from "./roblox-transfer.functions";

const KEY = "bestottr-demo-v2";
const initial: State = IS_DEMO ? normalizeState(seedState(), Date.now()) : {
  listings: [], watchlist: [], deals: [], roblox: { connected: false },
  admin: { users: [], disputes: [], flags: [], txn: {} },
};
let state: State = initial;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}
function set(fn: (s: State) => State) {
  requireDemo();
  state = fn(state);
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
  emit();
}

export function hydrateStore() {
  if (!IS_DEMO) return;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      state = JSON.parse(raw) as State;
      state = normalizeState(state, Date.now());
      // Migrate staged file deals from the old delivery flow: access is now granted instantly.
      state = {
        ...state,
        deals: state.deals.map((d) =>
          d.kind === "file" && d.stage < FILE_STAGES.length - 1
            ? { ...d, stage: FILE_STAGES.length - 1, funded: true, delivery: { released: true, confirmed: true } }
            : d,
        ),
      };
      emit();
    }
  } catch {
    /* ignore */
  }
}

export function useAppState() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
    () => state,
    () => initial,
  );
}

export const getState = () => state;

const patchListing = (s: State, id: string, fn: (l: Listing) => Listing): State => ({
  ...s,
  listings: s.listings.map((l) => (l.id === id ? fn(l) : l)),
});
const patchDeal = (id: string, fn: (d: Deal) => Deal) =>
  set((s) => ({ ...s, deals: s.deals.map((d) => (d.id === id ? fn(d) : d)) }));
const log = (d: Deal, text: string): Deal => ({ ...d, log: [{ at: Date.now(), text }, ...d.log] });

export const actions = {
  reset() {
    const fresh = normalizeState(seedState(), Date.now());
    set(() => fresh);
  },
  toggleWatch(id: string) {
    set((s) => ({
      ...s,
      watchlist: s.watchlist.includes(id) ? s.watchlist.filter((w) => w !== id) : [...s.watchlist, id],
    }));
  },
  placeBid(id: string, amount: number): { ok: boolean; error?: string } {
    const l = state.listings.find((x) => x.id === id);
    if (!l || l.status !== "live" || l.format !== "auction") return { ok: false, error: "This auction is not accepting bids." };
    if (l.endsAt < Date.now()) return { ok: false, error: "This auction has ended." };
    const min = minNextBid(l.currentBid, l.bids.length > 0, l.startingBid);
    if (!Number.isFinite(amount) || amount < Math.max(min, 1)) return { ok: false, error: `Minimum bid is $${min.toLocaleString("en-US")}.` };
    set((s) =>
      patchListing(s, id, (x) => ({
        ...x,
        currentBid: amount,
        bids: [{ id: `b${Date.now()}`, bidder: ME, amount, at: Date.now() }, ...x.bids],
      })),
    );
    return { ok: true };
  },
  createDeal(listingId: string, price: number): string {
    const existing = state.deals.find((d) => d.listingId === listingId);
    if (existing) return existing.id;
    const l = state.listings.find((x) => x.id === listingId)!;
    const id = `d-${1100 + state.deals.length}`;
    const blank = (items: { id: string }[]) => Object.fromEntries(items.map((i) => [i.id, false]));
    const deal: Deal = {
      id,
      listingId,
      kind: l.kind,
      buyer: ME,
      seller: l.seller.handle,
      price,
      fee: buyerPremium(price),
      stage: 0,
      agreement: { buyer: false, seller: false },
      funded: false,
      dd: blank(DD_ITEMS),
      transfer: { ...blank(TRANSFER_ITEMS), ...(l.hasGroup ? {} : { group: true }) },
      received: { ...blank(TRANSFER_ITEMS), ...(l.hasGroup ? {} : { group: true }) },
      delivery: { released: false, confirmed: false },
      log: [{ at: Date.now(), text: `Deal room opened at ${"$" + price.toLocaleString("en-US")}` }],
      createdAt: Date.now(),
      ...(l.kind !== "file" ? { acquisition: createTransfer(id, assetFromListing(l), price + buyerPremium(price), Date.now()) } : {}),
    };
    set((s) => ({
      ...patchListing(s, listingId, (x) => ({ ...x, status: "ended", endsAt: Math.min(x.endsAt, Date.now()) })),
      deals: [deal, ...s.deals],
    }));
    return id;
  },
  /** Demo file purchase: payment simulated, access granted instantly, limited inventory decremented. */
  buyFile(listingId: string): { ok: boolean; dealId?: string; error?: string } {
    const l = state.listings.find((x) => x.id === listingId);
    if (!l || l.kind !== "file" || !l.file) return { ok: false, error: "Not a file listing." };
    if (l.status !== "live") return { ok: false, error: "This listing is no longer available." };
    const inv = applyPurchase(l.file.inventory);
    if (!inv) return { ok: false, error: "Sold out." };
    const dealId = actions.fulfillFileDeal(listingId, l.buyNow ?? l.currentBid);
    set((s) =>
      patchListing(s, listingId, (x) => ({
        ...x,
        file: x.file ? { ...x.file, inventory: inv } : x.file,
        ...(isSoldOut(inv) ? { status: "sold" as const, endsAt: Math.min(x.endsAt, Date.now()) } : {}),
      })),
    );
    return { ok: true, dealId };
  },
  /** Creates an instantly-fulfilled file transaction: paid, access granted, no seller action required. */
  fulfillFileDeal(listingId: string, price: number): string {
    const l = state.listings.find((x) => x.id === listingId)!;
    const id = `d-${1100 + state.deals.length}`;
    const deal: Deal = {
      id,
      listingId,
      kind: "file",
      buyer: ME,
      seller: l.seller.handle,
      price,
      fee: buyerPremium(price),
      stage: FILE_STAGES.length - 1,
      agreement: { buyer: true, seller: true },
      funded: true,
      dd: {},
      transfer: {},
      received: {},
      delivery: { released: true, confirmed: true },
      log: [
        { at: Date.now(), text: "File access granted instantly — available in the buyer's library" },
        { at: Date.now(), text: `Payment received ($${(price + buyerPremium(price)).toLocaleString("en-US")}) — order fulfilled automatically` },
      ],
      createdAt: Date.now(),
    };
    set((s) => ({ ...s, deals: [deal, ...s.deals] }));
    return id;
  },
  buyNow(listingId: string) {
    const l = state.listings.find((x) => x.id === listingId)!;
    return actions.createDeal(listingId, l.buyNow ?? l.currentBid);
  },
  /** Demo: ensure you're the top bidder above reserve, then close the auction. */
  winAuction(listingId: string) {
    const l = state.listings.find((x) => x.id === listingId)!;
    let price = l.currentBid;
    const top = l.bids[0];
    if (!top || top.bidder !== ME || (l.reserve && l.currentBid < l.reserve)) {
      price = Math.max(minNextBid(l.currentBid, l.bids.length > 0, l.startingBid), l.reserve ?? 0);
      set((s) =>
        patchListing(s, listingId, (x) => ({
          ...x,
          currentBid: price,
          bids: [{ id: `b${Date.now()}`, bidder: ME, amount: price, at: Date.now() }, ...x.bids],
        })),
      );
    }
    // File auctions: single exclusive copy — close the listing and grant access instantly.
    if (l.kind === "file") {
      const id = actions.fulfillFileDeal(listingId, price);
      set((s) =>
        patchListing(s, listingId, (x) => ({
          ...x,
          status: "sold",
          endsAt: Math.min(x.endsAt, Date.now()),
          file: x.file ? { ...x.file, inventory: { ...x.file.inventory, remaining: 0 } } : x.file,
        })),
      );
      return id;
    }
    return actions.createDeal(listingId, price);
  },
  /* ---------- Experience acquisition (money moves only via the transfer engine) ---------- */
  selectTarget(dealId: string, target: TargetAccount) { return stepAcq(dealId, (t, now) => chooseTarget(t, target, now)); },
  confirmTarget(dealId: string) { return stepAcq(dealId, (t, now) => confirmTarget(t, now)); },
  /** Demo payment: the mock provider places a hold. */
  fundExperienceDeal(dealId: string) { return stepAcq(dealId, (t, now) => fundTransfer(t, now)); },
  /** Status-only claim; never releases payment. */
  sellerMarkTransferStarted(dealId: string) { return stepAcq(dealId, (t, now) => markTransferStarted(t, now)); },
  cancelExperienceDeal(dealId: string, by: Party) { return stepAcq(dealId, (t, now) => cancelTransfer(t, by, now)); },
  requestTransferExtension(dealId: string, by: Party) { return stepAcq(dealId, (t, now) => requestExtension(t, by, now)); },
  /** "Check now": requests a fresh observation from the ownership source; callers cannot supply results. */
  async runOwnershipCheck(dealId: string): Promise<{ ok: boolean; error?: string }> {
    const t = state.deals.find((d) => d.id === dealId)?.acquisition;
    const now = Date.now();
    if (!t || !canCheckNow(t, now)) return { ok: false, error: "Please wait 30 seconds between checks." };
    stepAcq(dealId, (x) => ({ ok: true, t: { ...x, verification: { ...x.verification, lastManualCheckAt: now } } }));
    const outcome = await observe(t);
    return stepAcq(dealId, (x, n) => applyCheck(x, outcome, n));
  },
  /**
   * Monitor tick over all active acquisitions. DEMO: driven by a client interval
   * using persisted nextCheckAt/expiresAt so reloads recover. PRODUCTION: run this
   * same engine from a server scheduler/worker with a row lock per deal.
   */
  runMonitorTick() {
    if (!IS_DEMO) return;
    for (const d of state.deals) {
      const t = d.acquisition;
      if (!t || !(MONITORED.includes(t.state) || t.state === "payout_releasing" || t.state === "refunding")) continue;
      if (t.asset.demo) stepAcq(d.id, (x, now) => tick(x, now, () => observeDemo(state.robloxWorld ?? {}, x.asset, now)));
      else if (t.verification.nextCheckAt !== null && Date.now() >= t.verification.nextCheckAt) {
        void observe(t).then((o) => stepAcq(d.id, (x, now) => tick(x, now, () => o)));
      } else stepAcq(d.id, (x, now) => tick(x, now, () => ({ error: "not due", checkedAt: now })));
    }
  },
  /** DEV/DEMO ONLY: mutate the simulated Roblox world or clock for a demo deal. */
  demoSimulate(dealId: string, kind: "target" | "wrong_user" | "group_admin_only" | "outage" | "restore" | "expire") {
    const t = state.deals.find((d) => d.id === dealId)?.acquisition;
    if (!t || !t.asset.demo) return;
    if (kind === "expire") {
      stepAcq(dealId, (x, now) => ({ ok: true, t: { ...x, expiresAt: now, events: [{ at: now, kind: "demo", text: "DEMO: clock fast-forwarded to the deadline" }, ...x.events] } }));
      actions.runMonitorTick();
      return;
    }
    const cur = state.robloxWorld?.[t.asset.universeId] ?? initialWorldEntry(t.asset);
    const target = t.target?.userId ?? "0";
    const next: DemoWorldEntry =
      kind === "outage" ? { ...cur, outage: true }
      : kind === "restore" ? { ...cur, outage: false }
      : kind === "group_admin_only" ? { ...cur } // buyer gets admin rank; owner unchanged — roles are not observable ownership
      : t.asset.mode !== "user" ? { ...cur, groupOwnerId: kind === "target" ? target : "31337001" }
      : { ...cur, creatorId: kind === "target" ? target : "31337001" };
    set((s) => ({ ...s, robloxWorld: { ...(s.robloxWorld ?? {}), [t.asset.universeId]: next } }));
    stepAcq(dealId, (x, now) => ({ ok: true, t: { ...x, verification: { ...x.verification, nextCheckAt: now }, events: [{ at: now, kind: "demo", text: `DEMO: simulated Roblox state — ${kind.replace(/_/g, " ")}` }, ...x.events] } }));
  },
  connectRoblox() {
    set((s) => ({ ...s, roblox: { connected: true, username: DEMO_USERNAME, userId: DEMO_USER_ID } }));
  },
  disconnectRoblox() {
    set((s) => ({ ...s, roblox: { connected: false } }));
  },
  publishListing(l: Listing) {
    set((s) => ({ ...s, listings: [l, ...s.listings] }));
  },
  updateCommunity(id: string, changes: CommunityChanges): { ok: boolean; error?: string } {
    const listing = state.listings.find((l) => l.id === id);
    if (!listing) return { ok: false, error: "Listing not found." };
    try {
      const edited = editCommunity(listing, ME, changes);
      set((s) => patchListing(s, id, () => edited));
      return { ok: true };
    } catch (error) { return { ok: false, error: error instanceof Error ? error.message : "Couldn't save changes." }; }
  },
  updateExperience(id: string, changes: ExperienceChanges): { ok: boolean; error?: string } {
    const listing = state.listings.find((l) => l.id === id);
    if (!listing) return { ok: false, error: "Listing not found." };
    try {
      const edited = editExperience(listing, ME, changes);
      set((s) => patchListing(s, id, () => edited));
      return { ok: true };
    } catch (error) { return { ok: false, error: error instanceof Error ? error.message : "Couldn't save changes." }; }
  },
  setListingStatus(id: string, status: Listing["status"]) {
    set((s) => patchListing(s, id, (l) => ({ ...l, status })));
  },
  setAdmin(kind: "users" | "disputes" | "flags", id: string, status: AdminItem["status"]) {
    set((s) => ({ ...s, admin: { ...s.admin, [kind]: s.admin[kind].map((i) => (i.id === id ? { ...i, status } : i)) } }));
  },
  setTxn(dealId: string, v: "approved" | "held") {
    set((s) => ({ ...s, admin: { ...s.admin, txn: { ...s.admin.txn, [dealId]: v } } }));
  },
};


async function observe(t: ExperienceTransfer): Promise<CheckOutcome> {
  const now = Date.now();
  if (t.asset.demo) return observeDemo(state.robloxWorld ?? {}, t.asset, now);
  try {
    if (t.asset.mode === "community") return (await lookupLiveCommunityOwnership({ data: { groupId: t.asset.groupId! } })) as CheckOutcome;
    return (await lookupLiveOwnership({ data: { universeId: t.asset.universeId, groupId: t.asset.groupId } })) as CheckOutcome;
  } catch {
    return { error: "lookup failed", checkedAt: now };
  }
}

function stepAcq(dealId: string, fn: (t: ExperienceTransfer, now: number) => StepResult): { ok: boolean; error?: string } {
  requireDemo();
  const d = state.deals.find((x) => x.id === dealId);
  if (!d?.acquisition) return { ok: false, error: "Not an Experience acquisition." };
  const r = fn(d.acquisition, Date.now());
  if (r.t !== d.acquisition) {
    const t = r.t;
    set((s) => {
      let n: State = { ...s, deals: s.deals.map((x) => (x.id === dealId ? { ...x, acquisition: t, funded: t.payment.status !== "none" } : x)) };
      if (t.state === "completed") n = patchListing(n, d.listingId, (l) => ({ ...l, status: "sold" }));
      return n;
    });
  }
  return r.error ? { ok: r.ok, error: r.error } : { ok: r.ok };
}

/** Attach acquisitions to Experience deals created before the automated flow (seed + saved state). */
export function normalizeState(s: State, now: number): State {
  const deals = s.deals.map((d) => {
    if (d.kind !== "experience" || d.acquisition) return d;
    const l = s.listings.find((x) => x.id === d.listingId);
    if (!l) return d;
    let t = createTransfer(d.id, assetFromListing(l), d.price + d.fee, d.createdAt);
    if (!d.funded) return { ...d, acquisition: t };
    const p = d.buyer === ME ? findDemoProfile(DEMO_USER_ID)! : findDemoProfile("90412277")!;
    const fundedAt = now - Math.min(50 * 3600_000, Math.max(0, now - d.createdAt));
    t = chooseTarget(t, { ...p, profileUrl: profileUrlFor(p.userId), source: "profile_url" }, fundedAt).t;
    t = confirmTarget(t, fundedAt).t;
    t = fundTransfer(t, fundedAt).t;
    if (d.stage >= 3) t = markTransferStarted(t, fundedAt + 3600_000).t;
    t = { ...t, verification: { ...t.verification, nextCheckAt: now }, events: [{ at: now, kind: "migrated", text: "Deal moved to automated ownership verification" }, ...t.events] };
    return { ...d, acquisition: t };
  });
  return { ...s, deals };
}
