import { describe, expect, it } from "vitest";
import { buyerPremium, minNextBid, totalCommitment } from "@/lib/pricing";

describe("pricing rules", () => {
  it("first bid must meet starting bid", () => {
    expect(minNextBid(0, false, 20000)).toBe(20000);
  });
  it("increment is 5% rounded up to $50", () => {
    expect(minNextBid(42500, true, 20000)).toBe(44650);
  });
  it("increment is at least $250", () => {
    expect(minNextBid(1000, true, 500)).toBe(1250);
  });
  it("buyer premium is 2.5%", () => {
    expect(buyerPremium(40000)).toBe(1000);
    expect(totalCommitment(40000)).toBe(41000);
  });
});
