import { appendDigit, backspaceCents, centsToDisplay, parseCurrencyInput } from "@/lib/currency";
import { cn } from "@/lib/utils";

const NAV_KEYS = new Set(["Tab", "Enter", "Escape", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"]);

/**
 * POS-style currency field backed by integer cents. Digits shift from cents
 * toward dollars as typed (1 -> $0.01, 1234 -> $12.34); backspace shifts back.
 * Paste normalizes "$1,234.56" / "1234.56" / "123456" to an exact amount.
 */
export function CurrencyInput({
  valueCents,
  onChange,
  id,
  label,
  className,
}: {
  valueCents: number;
  onChange: (cents: number) => void;
  id?: string;
  label?: string;
  className?: string;
}) {
  return (
    <input
      id={id}
      aria-label={label}
      className={cn("field num", className)}
      inputMode="numeric"
      autoComplete="off"
      spellCheck={false}
      value={centsToDisplay(valueCents)}
      onKeyDown={(e) => {
        if (e.metaKey || e.ctrlKey || e.altKey) return; // allow copy/paste/select-all shortcuts
        if (/^\d$/.test(e.key)) {
          e.preventDefault();
          onChange(appendDigit(valueCents, Number(e.key)));
        } else if (e.key === "Backspace" || e.key === "Delete") {
          e.preventDefault();
          onChange(backspaceCents(valueCents));
        } else if (!NAV_KEYS.has(e.key)) {
          e.preventDefault(); // ignore non-numeric entry
        }
      }}
      onPaste={(e) => {
        e.preventDefault();
        const parsed = parseCurrencyInput(e.clipboardData.getData("text"));
        if (parsed !== null) onChange(parsed);
      }}
      onChange={(e) => {
        // Fallback for autofill/IME — normal typing is handled in onKeyDown.
        const parsed = parseCurrencyInput(e.target.value);
        if (parsed !== null && parsed !== valueCents) onChange(parsed);
      }}
    />
  );
}
