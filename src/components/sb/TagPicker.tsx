import { useState } from "react";
import { toast } from "sonner";
import { EXPERIENCE_TAGS, MAX_TAGS, toggleTag } from "@/lib/tags";
import { cn } from "@/lib/utils";

export function TagChip({ tag, on, onClick }: { tag: string; on?: boolean; onClick?: () => void }) {
  const cls = cn(
    "inline-flex h-7 items-center rounded-md border px-2.5 text-xs transition-colors",
    on ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:border-foreground/60 hover:text-foreground",
  );
  if (!onClick) return <span className={cn(cls, "h-6 px-2")}>{tag}</span>;
  return <button type="button" aria-pressed={on} onClick={onClick} className={cls}>{tag}</button>;
}

export function TagPicker({ value, onChange, suggested }: { value: string[]; onChange: (v: string[]) => void; suggested: string[] }) {
  const [all, setAll] = useState(false);
  const toggle = (t: string) => {
    const next = toggleTag(value, t);
    if (!next) return void toast.error(`You can select up to ${MAX_TAGS} tags.`);
    onChange(next);
  };
  const extras = value.filter((t) => !suggested.includes(t));
  return (
    <div className="space-y-3" data-testid="tag-picker">
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-medium">Tags</span>
        <span className="num text-xs text-muted-foreground">{value.length}/{MAX_TAGS} selected</span>
      </div>
      <div>
        <div className="mb-2 text-xs text-muted-foreground">Suggested for this experience</div>
        <div className="flex flex-wrap gap-1.5">
          {suggested.map((t) => <TagChip key={t} tag={t} on={value.includes(t)} onClick={() => toggle(t)} />)}
          {!all && extras.map((t) => <TagChip key={t} tag={t} on onClick={() => toggle(t)} />)}
        </div>
      </div>
      <button type="button" onClick={() => setAll((a) => !a)} className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
        {all ? "Hide all tags" : "More tags"}
      </button>
      {all && (
        <div className="flex flex-wrap gap-1.5 border-t border-border pt-3">
          {EXPERIENCE_TAGS.map((t) => <TagChip key={t} tag={t} on={value.includes(t)} onClick={() => toggle(t)} />)}
        </div>
      )}
    </div>
  );
}
