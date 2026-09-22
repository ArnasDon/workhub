"use client";

import { useRef, useState, useTransition } from "react";
import { CornerDownLeft } from "lucide-react";
import { toast } from "sonner";
import { addLogEntry } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { EntryKindPicker } from "@/components/entry-kind-picker";
import type { USER_ENTRY_KINDS } from "@/lib/constants";

export function LogEntryForm({ initiativeId }: { initiativeId: string }) {
  const [body, setBody] = useState("");
  const [kind, setKind] = useState<(typeof USER_ENTRY_KINDS)[number]>("update");
  const [pending, start] = useTransition();
  const ref = useRef<HTMLTextAreaElement>(null);

  function submit() {
    if (!body.trim()) return;
    start(async () => {
      const res = await addLogEntry({ initiativeId, body, kind });
      if (!res.ok) {
        toast.error(res.error ?? "Could not save");
        return;
      }
      setBody("");
      setKind("update");
      ref.current?.focus();
    });
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="space-y-2 rounded-xl border bg-card p-3 shadow-xs focus-within:border-primary/50"
    >
      <Textarea
        ref={ref}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
            e.preventDefault();
            submit();
          }
        }}
        placeholder="Add an update: what happened, what you decided, what's next… (Markdown ok)"
        aria-label="New log entry"
        rows={3}
        className="min-h-20 resize-y border-0 bg-transparent p-1 shadow-none focus-visible:ring-0"
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <EntryKindPicker value={kind} onChange={setKind} />
        <Button type="submit" size="sm" disabled={pending || !body.trim()}>
          {pending ? "Saving…" : "Add entry"}
          <CornerDownLeft data-icon="inline-end" aria-hidden className="opacity-70" />
        </Button>
      </div>
    </form>
  );
}
