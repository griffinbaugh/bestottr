import type { Listing } from "./data";

export const SELLER_PROVIDED_NOTE = "* Seller-provided information; not independently verified by bestottr.";

/** Seller-entered revenue, or null when the seller chose not to provide it. Legacy listings count as provided. */
export const sellerRevenue = (l: Pick<Listing, "financialsProvided" | "monthlyRevenue">) => (l.financialsProvided === false ? null : l.monthlyRevenue);
export const sellerProfit = (l: Pick<Listing, "financialsProvided" | "monthlyProfit">) => (l.financialsProvided === false ? null : l.monthlyProfit);

/** Reserve is optional; when enabled it can't be below the starting bid. */
export function validateReserve(useReserve: boolean, reserveCents: number, startCents: number): string | null {
  if (!useReserve) return null;
  if (reserveCents < startCents) return "Reserve can't be below the starting bid.";
  return null;
}
