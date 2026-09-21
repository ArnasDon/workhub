"use client";

import { useActionState, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { Initiative, Link as LinkType } from "@/db/schema";
import { PRIORITIES, PRIORITY_LABEL, STATUSES, STATUS_LABEL, STATUS_STYLE } from "@/lib/constants";
import type { ActionState } from "@/lib/actions";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Props = {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  initiative?: Initiative;
  areas: string[];
  submitLabel: string;
  onSaved?: () => void;
};

export function InitiativeForm({ action, initiative, areas, submitLabel, onSaved }: Props) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    async (prev, fd) => {
      const res = await action(prev, fd);
      if (res.ok) onSaved?.();
      return res;
    },
    { ok: false },
  );
  const [links, setLinks] = useState<LinkType[]>(initiative?.links?.length ? initiative.links : []);
  const errors = state.fieldErrors ?? {};
  const listId = "areas-list";

  function updateLink(i: number, patch: Partial<LinkType>) {
    setLinks((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  return (
    <form action={formAction} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          name="title"
          required
          autoFocus={!initiative}
          defaultValue={initiative?.title ?? ""}
          placeholder="e.g. Node.js hosting — MCP distribution"
          aria-invalid={Boolean(errors.title)}
        />
        {errors.title && <p className="text-sm text-destructive">{errors.title}</p>}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="area">Area / tag</Label>
          <Input
            id="area"
            name="area"
            list={listId}
            defaultValue={initiative?.area ?? ""}
            placeholder="e.g. Ads Integrations"
            autoComplete="off"
          />
          <datalist id={listId}>
            {areas.map((a) => (
              <option key={a} value={a} />
            ))}
          </datalist>
        </div>
        <div className="space-y-2">
          <Label htmlFor="targetDate">Target date</Label>
          <Input id="targetDate" name="targetDate" type="date" defaultValue={initiative?.targetDate ?? ""} />
          {errors.targetDate && <p className="text-sm text-destructive">{errors.targetDate}</p>}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <Select name="status" defaultValue={initiative?.status ?? "idea"}>
            <SelectTrigger id="status" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  <span className={cn("size-1.5 rounded-full", STATUS_STYLE[s].dot)} aria-hidden />
                  {STATUS_LABEL[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="priority">Priority</Label>
          <Select name="priority" defaultValue={initiative?.priority ?? "medium"}>
            <SelectTrigger id="priority" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRIORITIES.map((p) => (
                <SelectItem key={p} value={p}>
                  {PRIORITY_LABEL[p]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <fieldset className="space-y-2">
        <div className="flex items-center justify-between">
          <legend className="text-sm font-medium">Links</legend>
          <Button type="button" variant="ghost" size="xs" onClick={() => setLinks((ls) => [...ls, { label: "", url: "" }])}>
            <Plus data-icon="inline-start" aria-hidden />
            Add link
          </Button>
        </div>
        {links.length === 0 && (
          <p className="text-sm text-muted-foreground">Slack thread, doc, ticket — anything you keep re-finding.</p>
        )}
        <div className="space-y-2">
          {links.map((l, i) => (
            <div key={i} className="flex gap-2">
              <Input
                aria-label={`Link ${i + 1} label`}
                placeholder="Label"
                value={l.label}
                onChange={(e) => updateLink(i, { label: e.target.value })}
                className="w-1/3"
              />
              <Input
                aria-label={`Link ${i + 1} URL`}
                placeholder="https://…"
                type="url"
                value={l.url}
                onChange={(e) => updateLink(i, { url: e.target.value })}
                className="flex-1"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove link ${i + 1}`}
                onClick={() => setLinks((ls) => ls.filter((_, idx) => idx !== i))}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
        </div>
        <input type="hidden" name="links" value={JSON.stringify(links)} />
        {errors.links && <p className="text-sm text-destructive">{errors.links}</p>}
      </fieldset>

      {!initiative && (
        <div className="space-y-2">
          <Label htmlFor="firstNote">First log entry (optional)</Label>
          <Textarea
            id="firstNote"
            name="firstNote"
            rows={3}
            placeholder="Where things stand today, and why this exists."
            className="resize-y"
          />
        </div>
      )}

      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
