// Cents-based currency entry helpers. Integer cents everywhere to avoid
// floating-point drift; convert to dollars only at the data boundary.

const MAX_CENTS = 99_999_999_99; // $999,999,999.99

const clamp = (cents: number) => Math.max(0, Math.min(MAX_CENTS, Math.round(cents)));

/** 123456 -> "$1,234.56" */
export function centsToDisplay(cents: number): string {
  const safe = clamp(cents);
  const dollars = Math.floor(safe / 100);
  const rem = safe % 100;
  return `$${dollars.toLocaleString("en-US")}.${String(rem).padStart(2, "0")}`;
}

/** POS-style entry: typing a digit shifts existing digits toward dollars. */
export function appendDigit(cents: number, digit: number): number {
  return clamp(cents * 10 + digit);
}

/** Backspace shifts digits back toward cents. */
export function backspaceCents(cents: number): number {
  return Math.floor(clamp(cents) / 10);
}

/**
 * Parse pasted/typed currency text into cents.
 * "$1,234.56", "1234.56" and comma-grouped " $2,500 " read as dollars; a bare
 * integer like "123456" reads as cents (matching the digit-shift typing
 * model). Returns null for non-numeric input; empty string reads as $0.00.
 */
export function parseCurrencyInput(raw: string): number | null {
  const asDollars = raw.includes(".") || raw.includes(",");
  const cleaned = raw.replace(/[$,\s]/g, "");
  if (!cleaned) return 0;
  if (!/^\d+(\.\d*)?$/.test(cleaned)) return null;
  const [intPart, decPart = ""] = cleaned.split(".");
  const cents = asDollars ? Number(intPart) * 100 + Number((decPart + "00").slice(0, 2)) : Number(intPart);
  if (!Number.isFinite(cents)) return null;
  return clamp(cents);
}

/** Boundary conversion for the listing's dollar-number shape. */
export const centsToDollars = (cents: number) => clamp(cents) / 100;
