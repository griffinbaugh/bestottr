// Ownership sources for acquisition verification.
// Demo assets read a deterministic "demo Roblox world"; live assets are read
// server-side from Roblox public APIs (see roblox-transfer.functions.ts).
// Sources only return raw observations — the engine decides what counts.

import type { Listing } from "./data";
import { DEMO_EXPERIENCES } from "./roblox";
import type { AssetIdentity, CheckOutcome, Observation } from "./transfer";

function demoId(seed: string, len = 10): string {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  return String(1 + (h % 9)) + String(h).padStart(len, "7").slice(0, len - 1);
}

/** Immutable asset identity derived from the verified listing. */
export function assetFromListing(l: Listing): AssetIdentity {
  const fx = DEMO_EXPERIENCES.find((e) => e.placeId === l.experience?.placeId);
  const placeId = l.experience?.placeId ?? demoId(`${l.id}:place`);
  const universeId = l.experience?.universeId ?? fx?.universeId ?? demoId(`${l.id}:universe`);
  const mode = (l.experience?.creatorType ?? (l.hasGroup ? "Group" : "User")) === "Group" ? "group" : "user";
  const originalOwnerId = fx ? (fx.ownerUserId ?? fx.groupOwnerId ?? demoId(`${l.seller.handle}:owner`, 8)) : demoId(`${l.seller.handle}:owner`, 8);
  return {
    placeId,
    universeId,
    groupId: mode === "group" ? (fx?.groupId ?? demoId(`${l.id}:group`, 7)) : null,
    mode,
    originalOwnerId,
    originalOwnerName: l.experience?.creatorName ?? l.seller.handle,
    demo: true,
  };
}

/** DEMO ONLY: simulated public Roblox state per universe. */
export type DemoWorldEntry = { creatorType: "User" | "Group"; creatorId: string; groupOwnerId: string | null; outage: boolean };
export type DemoWorld = Record<string, DemoWorldEntry>;

export const initialWorldEntry = (a: AssetIdentity): DemoWorldEntry =>
  a.mode === "group"
    ? { creatorType: "Group", creatorId: a.groupId!, groupOwnerId: a.originalOwnerId, outage: false }
    : { creatorType: "User", creatorId: a.originalOwnerId, groupOwnerId: null, outage: false };

export function observeDemo(world: DemoWorld, a: AssetIdentity, now: number): CheckOutcome {
  const w = world[a.universeId] ?? initialWorldEntry(a);
  if (w.outage) return { error: "Roblox API unavailable (simulated)", checkedAt: now };
  const o: Observation = {
    placeId: a.placeId,
    universeId: a.universeId,
    creatorType: w.creatorType,
    creatorId: w.creatorId,
    groupOwnerId: w.creatorType === "Group" ? w.groupOwnerId : null,
    source: "demo:roblox-world",
    checkedAt: now,
  };
  return { observation: o };
}
