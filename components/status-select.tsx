"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { setStatus } from "@/lib/actions";
import { STATUSES, STATUS_LABEL, STATUS_STYLE, type Status } from "@/lib/constants";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/** Inline status control used in list rows and the detail header. Logs the transition. */
export function StatusSelect({
  id,
  status,
  waitingOn = "",
  size = "sm",
  className,
}: {
  id: string;
  status: Status;
  waitingOn?: string;
  size?: "sm" | "default";
  className?: string;
}) {
  const [value, setValue] = useState<Status>(status);
  const [pending, start] = useTransition();
  const [askWaiting, setAskWaiting] = useState<{ prev: Status } | null>(null);
  // Set when "waiting" is picked; the dialog opens once the select menu has closed (opening it inside onValueChange races the menu).
  const [pendingAsk, setPendingAsk] = useState<Status | null>(null);
  const [who, setWho] = useState(waitingOn);
  const [note, setNote] = useState("");

  function commit(next: Status, prev: Status, extra?: { waitingOn?: string; note?: string }) {
    setValue(next);
    start(async () => {
      const res = await setStatus({ id, status: next, ...extra });
      if (!res.ok) {
        setValue(prev);
        toast.error(res.error ?? "Could not change status");
      } else {
        toast.success(next === "waiting" && extra?.waitingOn ? `Waiting on ${extra.waitingOn}` : `Marked ${STATUS_LABEL[next]}`);
      }
    });
  }

  function onChange(next: string) {
    const prev = value;
    if (next === "waiting") {
      // Ask who, so the card can show "Waiting on Jane · 3d" and the log records it.
      setWho(waitingOn);
      setNote("");
      setPendingAsk(prev);
      setValue("waiting");
      return;
    }
    commit(next as Status, prev);
  }

  function submitWaiting(skip = false) {
    const prev = askWaiting?.prev ?? value;
    setAskWaiting(null);
    commit("waiting", prev, { waitingOn: skip ? "" : who.trim(), note: skip ? undefined : note.trim() || undefined });
  }

  return (
    <>
    <Dialog open={askWaiting !== null} onOpenChange={(open) => { if (!open && askWaiting) { setValue(askWaiting.prev); setAskWaiting(null); } }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Who are you waiting on?</DialogTitle>
          <DialogDescription>Shown on the card with how long it has been, and written to the log.</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submitWaiting();
          }}
          className="space-y-3"
        >
          <div className="space-y-1.5">
            <Label htmlFor={`waiting-on-${id}`}>Person or team</Label>
            <Input id={`waiting-on-${id}`} value={who} onChange={(e) => setWho(e.target.value)} placeholder="e.g. Legal, Jane, Ads API partner" autoFocus maxLength={80} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`waiting-note-${id}`}>What for (optional)</Label>
            <Textarea id={`waiting-note-${id}`} value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Contract review, API approval…" className="resize-none" />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => submitWaiting(true)}>
              Skip
            </Button>
            <Button type="submit">Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
    <Select
      value={value}
      onValueChange={onChange}
      disabled={pending}
      onOpenChange={(open) => {
        if (!open && pendingAsk !== null) {
          const prev = pendingAsk;
          setPendingAsk(null);
          // Let the menu finish closing before the dialog takes focus.
          setTimeout(() => setAskWaiting({ prev }), 0);
        }
      }}
    >
      <SelectTrigger
        size={size}
        aria-label="Status"
        className={cn("h-7 gap-1.5 border-transparent bg-transparent pl-2 pr-1.5 shadow-none", STATUS_STYLE[value].badge, className)}
      >
        {/* SelectValue must exist (Radix anchors the menu on it), and giving it children makes the label server-rendered instead of blank until hydration. */}
        <SelectValue>
          <span className="flex items-center gap-1.5">
            <span className={cn("size-1.5 shrink-0 rounded-full", STATUS_STYLE[value].dot)} aria-hidden />
            <span className="truncate">{STATUS_LABEL[value]}</span>
          </span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent align="end" position="popper">
        {STATUSES.map((s) => (
          <SelectItem key={s} value={s}>
            <span className={cn("size-1.5 rounded-full", STATUS_STYLE[s].dot)} aria-hidden />
            {STATUS_LABEL[s]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
    </>
  );
}
