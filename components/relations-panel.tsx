"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Ban, Link2, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { addRelation, removeRelation } from "@/lib/actions";
import { STATUS_STYLE, type Status } from "@/lib/constants";
import type { RelationView } from "@/lib/queries";
import type { RelationKind } from "@/db/schema";
import type { InitiativeOption } from "@/components/quick-capture";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

const DIRECTION_LABEL: Record<RelationView["direction"], string> = {
  blocked_by: "Blocked by",
  blocks: "Blocks",
  related: "Related",
};

export function RelationsPanel({
  initiativeId,
  relations,
  options,
}: {
  initiativeId: string;
  relations: RelationView[];
  options: InitiativeOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<RelationKind>("blocked_by");
  const [, start] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);

  const linkedIds = new Set(relations.map((r) => r.other.id));
  const candidates = options.filter((o) => o.id !== initiativeId && !linkedIds.has(o.id));

  function add(toId: string) {
    setOpen(false);
    start(async () => {
      const res = await addRelation({ fromId: initiativeId, toId, kind });
      if (!res.ok) toast.error(res.error ?? "Could not link");
      else router.refresh();
    });
  }

  function remove(id: string) {
    setPendingId(id);
    start(async () => {
      const res = await removeRelation(id);
      setPendingId(null);
      if (!res.ok) toast.error(res.error ?? "Could not unlink");
      else router.refresh();
    });
  }

  const groups = (["blocked_by", "blocks", "related"] as const)
    .map((d) => ({ direction: d, items: relations.filter((r) => r.direction === d) }))
    .filter((g) => g.items.length > 0);

  return (
    <section aria-labelledby="relations-heading" className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h2 id="relations-heading" className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Related work
        </h2>
        <Button type="button" variant="ghost" size="xs" onClick={() => setOpen(true)}>
          <Plus data-icon="inline-start" aria-hidden />
          Link initiative
        </Button>
      </div>

      {groups.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nothing linked. Mark what this is blocked by, or what it&rsquo;s related to.
        </p>
      ) : (
        <div className="space-y-3">
          {groups.map((g) => (
            <div key={g.direction}>
              <h3 className={cn("mb-1 flex items-center gap-1.5 text-xs font-medium", g.direction === "blocked_by" ? "text-status-blocked" : "text-muted-foreground")}>
                {g.direction === "blocked_by" ? <Ban className="size-3.5" aria-hidden /> : <Link2 className="size-3.5" aria-hidden />}
                {DIRECTION_LABEL[g.direction]}
              </h3>
              <ul className="space-y-1">
                {g.items.map((r) => (
                  <li key={r.id} className="flex items-center gap-2 rounded-lg border bg-card px-3 py-1.5 text-sm">
                    <Link href={`/initiatives/${r.other.id}`} className="min-w-0 flex-1 truncate font-medium hover:underline underline-offset-4">
                      {r.other.title}
                    </Link>
                    <StatusBadge status={r.other.status} className="h-5 px-1.5 text-[11px]" />
                    {r.direction !== "blocks" && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        aria-label={`Remove link to ${r.other.title}`}
                        disabled={pendingId === r.id}
                        onClick={() => remove(r.id)}
                        className="text-muted-foreground"
                      >
                        <X className="size-3.5" />
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="p-0 sm:max-w-lg">
          <DialogHeader className="px-4 pt-4">
            <DialogTitle>Link an initiative</DialogTitle>
            <DialogDescription>Pick how they relate, then choose the other initiative.</DialogDescription>
          </DialogHeader>
          <div role="radiogroup" aria-label="Relation kind" className="mx-4 grid grid-cols-2 rounded-lg bg-muted p-1 text-sm">
            {(["blocked_by", "related"] as const).map((k) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={kind === k}
                onClick={() => setKind(k)}
                className={cn("rounded-md px-3 py-1.5 transition-colors", kind === k ? "bg-card font-medium shadow-xs" : "text-muted-foreground hover:text-foreground")}
              >
                {k === "blocked_by" ? "Blocked by…" : "Related to…"}
              </button>
            ))}
          </div>
          <Command className="rounded-none border-t">
            <CommandInput placeholder="Search initiatives…" autoFocus />
            <CommandList>
              <CommandEmpty>No other initiatives match.</CommandEmpty>
              <CommandGroup>
                {candidates.map((o) => (
                  <CommandItem key={o.id} value={`${o.title} ${o.area}`} onSelect={() => add(o.id)} className="gap-2">
                    <span className={cn("size-1.5 shrink-0 rounded-full", STATUS_STYLE[o.status as Status].dot)} aria-hidden />
                    <span className="truncate">{o.title}</span>
                    {o.area && <span className="ml-auto truncate text-xs text-muted-foreground">{o.area}</span>}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>
    </section>
  );
}
