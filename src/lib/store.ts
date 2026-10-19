import { useSyncExternalStore } from "react";
import { DD_ITEMS, FILE_STAGES, ME, TRANSFER_ITEMS, seedState, type AdminItem, type Deal, type Listing, type State } from "./data";
import { applyPurchase, isSoldOut } from "./inventory";
import { buyerPremium, minNextBid } from "./pricing";

const KEY = "bestottr-demo-v2";
const initial = seedState();
let state: State = initial;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}
function set(fn: (s: State) => State) {
  state = fn(state);
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
  emit();
}

export function hydrateStore() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      state = JSON.parse(raw) as State;
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
    const fresh = seedState();
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
    if (!Number.isFinite(amount) || amount < min) return { ok: false, error: `Minimum bid is $${min.toLocaleString("en-US")}.` };
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
    };
    set((s) => ({
      ...patchListing(s, listingId, (x) => ({ ...x, status: "ended", endsAt: Math.min(x.endsAt, Date.now()) })),
      deals: [deal, ...s.deals],
    }));
    return id;
  },
  /** Demo file purchase: payment is simulated instantly, inventory decrements, deal opens at File Access. */
  buyFile(listingId: string): { ok: boolean; dealId?: string; error?: string } {
    const l = state.listings.find((x) => x.id === listingId);
    if (!l || l.kind !== "file" || !l.file) return { ok: false, error: "Not a file listing." };
    if (l.status !== "live") return { ok: false, error: "This listing is no longer available." };
    const inv = applyPurchase(l.file.inventory);
    if (!inv) return { ok: false, error: "Sold out." };
    const price = l.buyNow ?? l.currentBid;
    const id = `d-${1100 + state.deals.length}`;
    const deal: Deal = {
      id,
      listingId,
      kind: "file",
      buyer: ME,
      seller: l.seller.handle,
      price,
      fee: buyerPremium(price),
      stage: 1,
      agreement: { buyer: true, seller: true },
      funded: true,
      dd: {},
      transfer: {},
      received: {},
      delivery: { released: false, confirmed: false },
      log: [
        { at: Date.now(), text: `Payment received ($${(price + buyerPremium(price)).toLocaleString("en-US")}) — held in escrow` },
        { at: Date.now(), text: `Order placed at $${price.toLocaleString("en-US")}` },
      ],
      createdAt: Date.now(),
    };
    set((s) => ({
      ...patchListing(s, listingId, (x) => ({
        ...x,
        file: x.file ? { ...x.file, inventory: inv } : x.file,
        ...(isSoldOut(inv) ? { status: "sold" as const, endsAt: Math.min(x.endsAt, Date.now()) } : {}),
      })),
      deals: [deal, ...s.deals],
    }));
    return { ok: true, dealId: id };
  },
  releaseFile(dealId: string) {
    patchDeal(dealId, (d) => log({ ...d, delivery: { ...d.delivery, released: true } }, "Seller released file access"));
  },
  confirmFile(dealId: string) {
    patchDeal(dealId, (d) => log({ ...d, delivery: { ...d.delivery, confirmed: true } }, "Buyer confirmed successful download"));
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
    return actions.createDeal(listingId, price);
  },
  signAgreement(dealId: string, party: "buyer" | "seller") {
    patchDeal(dealId, (d) => log({ ...d, agreement: { ...d.agreement, [party]: true } }, `Agreement signed by ${party}`));
  },
  fund(dealId: string) {
    patchDeal(dealId, (d) => log({ ...d, funded: true }, `Buyer funded escrow ($${(d.price + d.fee).toLocaleString("en-US")})`));
  },
  toggle(dealId: string, group: "dd" | "transfer" | "received", key: string) {
    patchDeal(dealId, (d) => ({ ...d, [group]: { ...d[group], [key]: !d[group][key] } }));
  },
  advance(dealId: string) {
    const d = state.deals.find((x) => x.id === dealId);
    if (!d || !stageDone(d)) return;
    const last = d.kind === "file" ? FILE_STAGES.length - 1 : 5;
    const next = Math.min(last, d.stage + 1);
    set((s) => {
      let n: State = {
        ...s,
        deals: s.deals.map((x) => (x.id === dealId ? log({ ...x, stage: next }, next === last ? "Transaction complete — funds released to seller" : `Advanced to stage ${next + 1}`) : x)),
      };
      if (next === last) n = patchListing(n, d.listingId, (l) => ({ ...l, status: "sold" }));
      return n;
    });
  },
  autoComplete(dealId: string) {
    const d = state.deals.find((x) => x.id === dealId);
    if (!d) return;
    const all = (items: { id: string }[]) => Object.fromEntries(items.map((i) => [i.id, true]));
    patchDeal(dealId, (x) => {
      if (x.kind === "file") {
        switch (x.stage) {
          case 0: return log({ ...x, funded: true }, "Demo: payment received");
          case 1: return log({ ...x, delivery: { ...x.delivery, released: true } }, "Demo: seller released file access");
          case 2: return log({ ...x, delivery: { ...x.delivery, confirmed: true } }, "Demo: buyer confirmed download");
          default: return x;
        }
      }
      switch (x.stage) {
        case 0: return log({ ...x, agreement: { buyer: true, seller: true } }, "Demo: both parties signed");
        case 1: return log({ ...x, funded: true }, "Demo: escrow funded");
        case 2: return log({ ...x, dd: all(DD_ITEMS) }, "Demo: due diligence completed");
        case 3: return log({ ...x, transfer: all(TRANSFER_ITEMS) }, "Demo: seller completed all transfer items");
        case 4: return log({ ...x, received: all(TRANSFER_ITEMS) }, "Demo: buyer confirmed receipt of all items");
        default: return x;
      }
    });
  },
  connectRoblox() {
    set((s) => ({ ...s, roblox: { connected: true, username: "alexr_dev" } }));
  },
  publishListing(l: Listing) {
    set((s) => ({ ...s, listings: [l, ...s.listings] }));
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

export function stageDone(d: Deal) {
  const every = (r: Record<string, boolean>) => Object.values(r).every(Boolean);
  switch (d.stage) {
    case 0: return d.agreement.buyer && d.agreement.seller;
    case 1: return d.funded;
    case 2: return every(d.dd);
    case 3: return every(d.transfer);
    case 4: return every(d.received);
    default: return false;
  }
}
