import { useNavigate } from "@tanstack/react-router";
import { FileDown, Search } from "lucide-react";
import { useId, useMemo, useState } from "react";
import type { Listing } from "@/lib/data";
import { img } from "@/lib/images";
import { useAppState } from "@/lib/store";
import { cn } from "@/lib/utils";

export function searchListings(listings: Listing[], q: string, max = 6): Listing[] {
  const needle = q.trim().toLowerCase();
  if (!needle) return [];
  const hay = (l: Listing) =>
    `${l.title} ${l.tagline} ${l.genre} ${l.seller.name} ${(l.tags ?? []).join(" ")} ${l.file?.category ?? ""} ${l.file?.fileName ?? ""} ${l.file?.fileType ?? ""}`.toLowerCase();
  return listings.filter((l) => l.status === "live" && hay(l).includes(needle)).slice(0, max);
}

export function SearchBox({
  value,
  onChange,
  placeholder,
  submitLabel,
  className,
  inputClassName,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  submitLabel?: string;
  className?: string;
  inputClassName?: string;
}) {
  const { listings } = useAppState();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const listId = useId();
  const suggestions = useMemo(() => searchListings(listings, value), [listings, value]);
  const showList = open && value.trim().length > 0;

  const submit = () => {
    setOpen(false);
    setActive(-1);
    navigate({ to: "/browse", search: { q: value } });
  };
  const pick = (l: Listing) => {
    setOpen(false);
    setActive(-1);
    onChange(l.title);
    navigate({ to: "/listing/$id", params: { id: l.id } });
  };

  return (
    <form
      className={cn("relative", className)}
      onSubmit={(e) => {
        e.preventDefault();
        const sel = active >= 0 ? suggestions[active] : undefined;
        if (sel) pick(sel);
        else submit();
      }}
    >
      <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <input
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        aria-autocomplete="list"
        aria-label={placeholder}
        autoComplete="off"
        className={cn("field pl-11", submitLabel && "pr-32", inputClassName)}
        placeholder={placeholder}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setOpen(false);
            setActive(-1);
            return;
          }
          if (!showList || !suggestions.length) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => (a + 1) % suggestions.length);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => (a <= 0 ? suggestions.length - 1 : a - 1));
          }
        }}
      />
      {submitLabel && (
        <button
          type="submit"
          className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-all duration-150 ease-out hover:bg-primary/88 active:scale-[0.98]"
        >
          {submitLabel}
        </button>
      )}
      {showList && (
        <div
          id={listId}
          role="listbox"
          aria-label="Search suggestions"
          className="pop-in absolute inset-x-0 top-full z-40 mt-2 overflow-hidden rounded-lg border border-border bg-popover shadow-[var(--shadow-lift)]"
        >
          {suggestions.length ? (
            suggestions.map((l, i) => (
              <button
                key={l.id}
                id={`${listId}-${i}`}
                type="button"
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(l);
                }}
                onMouseEnter={() => setActive(i)}
                className={cn(
                  "flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors",
                  i === active ? "bg-accent" : "bg-transparent",
                )}
              >
                <img src={img(l.image)} alt="" width={56} height={32} loading="lazy" className="h-8 w-14 shrink-0 rounded border border-border object-cover" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-foreground">{l.title}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {l.kind === "file" && l.file ? `${l.file.category} · ${l.seller.name}` : `${l.genre} · ${l.seller.name}`}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                  {l.kind === "file" && <FileDown className="h-3 w-3" />}
                  {l.kind === "file" ? "File" : "Experience"}
                </span>
              </button>
            ))
          ) : (
            <button
              type="submit"
              className="flex w-full items-center gap-2 px-3 py-3 text-left text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <Search className="h-3.5 w-3.5" /> Search marketplace for “{value.trim()}”
            </button>
          )}
        </div>
      )}
    </form>
  );
}
