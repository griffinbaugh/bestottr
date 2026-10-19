import { describe, expect, it } from "vitest";
import { applyPurchase, isSoldOut, stockLabel, stockLeft, type Inventory } from "@/lib/inventory";

const limited = (total: number, remaining: number): Inventory => ({ mode: "limited", total, remaining });
const unlimited: Inventory = { mode: "unlimited" };

describe("file inventory", () => {
  it("decrements limited stock on each purchase", () => {
    const inv = applyPurchase(limited(20, 7));
    expect(inv).toEqual({ mode: "limited", total: 20, remaining: 6 });
  });

  it("rejects the purchase when limited stock is exhausted", () => {
    expect(applyPurchase(limited(5, 0))).toBeNull();
  });

  it("reaches sold out exactly when the last copy is bought", () => {
    const inv = applyPurchase(limited(1, 1));
    expect(inv).not.toBeNull();
    expect(isSoldOut(inv!)).toBe(true);
    expect(applyPurchase(inv!)).toBeNull();
  });

  it("never decrements or closes unlimited inventory", () => {
    expect(applyPurchase(unlimited)).toEqual(unlimited);
    expect(stockLeft(unlimited)).toBe(Infinity);
    expect(isSoldOut(unlimited)).toBe(false);
  });

  it("labels stock for cards", () => {
    expect(stockLabel(limited(20, 7))).toBe("7 left");
    expect(stockLabel(limited(20, 0))).toBe("Sold out");
    expect(stockLabel(unlimited)).toBe("Unlimited");
  });
});
