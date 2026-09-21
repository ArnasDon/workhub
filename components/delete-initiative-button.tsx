"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { deleteInitiative } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function DeleteInitiativeButton({ id, title, entryCount }: { id: string; title: string; entryCount: number }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive">
          <Trash2 data-icon="inline-start" aria-hidden />
          Delete
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete “{title}”?</DialogTitle>
          <DialogDescription>
            This permanently removes the initiative and its {entryCount} log {entryCount === 1 ? "entry" : "entries"}.
            Archiving keeps the history; deleting does not. Export first if in doubt.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Keep it
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={pending}
            onClick={() => start(async () => { await deleteInitiative(id); })}
          >
            {pending ? "Deleting…" : "Delete permanently"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
