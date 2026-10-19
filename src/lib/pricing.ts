export const BUYER_PREMIUM_RATE = 0.025;

/** Minimum next bid: starting bid if no bids, else current + max($250, 5% rounded up to $50). */
export function minNextBid(current: number, hasBids: boolean, starting: number) {
  if (!hasBids) return starting;
  const inc = Math.max(250, Math.ceil((current * 0.05) / 50) * 50);
  return current + inc;
}

export const buyerPremium = (amount: number) => Math.round(amount * BUYER_PREMIUM_RATE);
export const totalCommitment = (amount: number) => amount + buyerPremium(amount);
