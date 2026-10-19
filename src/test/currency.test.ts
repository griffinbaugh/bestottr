import { describe, expect, it } from "vitest";
import { appendDigit, backspaceCents, centsToDisplay, centsToDollars, parseCurrencyInput } from "@/lib/currency";

describe("currency entry", () => {
  it("digits shift from cents toward dollars", () => {
    let c = 0;
    c = appendDigit(c, 1);
    expect(centsToDisplay(c)).toBe("$0.01");
    c = appendDigit(c, 2);
    expect(centsToDisplay(c)).toBe("$0.12");
    c = appendDigit(c, 3);
    expect(centsToDisplay(c)).toBe("$1.23");
    c = appendDigit(c, 4);
    expect(centsToDisplay(c)).toBe("$12.34");
    c = appendDigit(c, 5);
    c = appendDigit(c, 6);
    expect(centsToDisplay(c)).toBe("$1,234.56");
  });
  it("backspace moves the value back naturally", () => {
    expect(centsToDisplay(backspaceCents(1234))).toBe("$1.23");
    expect(backspaceCents(1)).toBe(0);
    expect(centsToDisplay(backspaceCents(0))).toBe("$0.00");
  });
  it("parses pasted currency strings to exact cents", () => {
    expect(parseCurrencyInput("$1,234.56")).toBe(123456);
    expect(parseCurrencyInput("1234.56")).toBe(123456);
    expect(parseCurrencyInput("123456")).toBe(123456);
    expect(parseCurrencyInput(" $2,500 ")).toBe(250000);
  });
  it("never allows more than two decimals and rejects non-numeric input", () => {
    expect(parseCurrencyInput("10.999")).toBe(1099);
    expect(parseCurrencyInput("abc")).toBeNull();
    expect(parseCurrencyInput("1.2.3")).toBeNull();
    expect(parseCurrencyInput("")).toBe(0);
  });
  it("preserves cents exactly at the dollar boundary", () => {
    expect(centsToDollars(12345)).toBe(123.45);
    expect(centsToDollars(9900)).toBe(99);
  });
});
