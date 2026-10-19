import type { FileMeta } from "./data";

export type Inventory = FileMeta["inventory"];

/** Remaining copies for sale. Unlimited → Infinity. */
export function stockLeft(inv: Inventory): number {
  return inv.mode === "unlimited" ? Infinity : inv.remaining;
}

export function isSoldOut(inv: Inventory): boolean {
  return inv.mode === "limited" && inv.remaining <= 0;
}

/**
 * Apply one purchase to inventory.
 * Returns the updated inventory, or null when the sale must be rejected
 * (limited stock exhausted). Unlimited inventory never changes.
 */
export function applyPurchase(inv: Inventory): Inventory | null {
  if (inv.mode === "unlimited") return inv;
  if (inv.remaining <= 0) return null;
  return { ...inv, remaining: inv.remaining - 1 };
}

/** Short label for cards/dashboards: "7 left", "Unlimited", "Sold out". */
export function stockLabel(inv: Inventory): string {
  if (inv.mode === "unlimited") return "Unlimited";
  return inv.remaining > 0 ? `${inv.remaining} left` : "Sold out";
}
