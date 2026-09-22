"use client";

import { cn } from "@/lib/utils";
import { ENTRY_KIND_LABEL, USER_ENTRY_KINDS, type EntryKind } from "@/lib/constants";

type UserKind = (typeof USER_ENTRY_KINDS)[number];

export function EntryKindPicker({ value, onChange, className }: { value: UserKind; onChange: (k: UserKind) => void; className?: string }) {
  return (
    <div role="radiogroup" aria-label="Entry type" className={cn("inline-flex flex-wrap gap-1", className)}>
      {USER_ENTRY_KINDS.map((k) => (
        <button
          key={k}
          type="button"
          role="radio"
          aria-checked={value === k}
          onClick={() => onChange(k)}
          className={cn(
            "rounded-full border px-2 py-0.5 text-xs transition-colors",
            value === k
              ? k === "decision"
                ? "border-primary/40 bg-primary/10 text-primary"
                : k === "blocker"
                  ? "border-status-blocked/40 bg-status-blocked/10 text-status-blocked"
                  : k === "meeting"
                    ? "border-status-waiting/40 bg-status-waiting/10 text-status-waiting"
                    : "border-foreground/30 bg-secondary text-secondary-foreground"
              : "border-transparent text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          {ENTRY_KIND_LABEL[k as EntryKind]}
        </button>
      ))}
    </div>
  );
}
