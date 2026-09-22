"use client";

import { useActionState, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { Initiative, Link as LinkType, Priority, Status } from "@/db/schema";
import { PRIORITIES, PRIORITY_LABEL, STATUSES, STATUS_LABEL, STATUS_STYLE } from "@/lib/constants";
import type { ActionState } from "@/lib/actions";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MarkdownEditor } from "@/components/markdown-editor";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Defaults = Partial<Pick<Initiative, "title" | "description" | "area" | "status" | "priority" | "checkInDays" | "links">>;

type Props = {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  initiative?: Initiative;
  /** Prefill for a new initiative (e.g. from a template). Ignored when editing. */
  defaults?: Defaults;
  /** Template to copy to-dos from on create. */
  templateId?: string;
  areas: string[];
  submitLabel: string;
  onSaved?: () => void;
};

const CADENCE_LABEL: Record<string, string> = { default: "7 days (default)", "3": "3 days", "14": "2 weeks", "30": "Month", "90": "Quarter" };

export function InitiativeForm({ action, initiative, defaults, templateId, areas, submitLabel, onSaved }: Props) {
  const d: Defaults = initiative ?? defaults ?? {};
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    async (prev, fd) => {
      const res = await action(prev, fd);
      if (res.ok) onSaved?.();
      return res;
    },
    { ok: false },
  );
  const [links, setLinks] = useState<LinkType[]>(d.links?.length ? d.links : []);
  const [status, setStatus] = useState<Status>(d.status ?? "idea");
  const [priority, setPriority] = useState<Priority>(d.priority ?? "medium");
  const [cadence, setCadence] = useState<string>(d.checkInDays ? String(d.checkInDays) : "default");
  const errors = state.fieldErrors ?? {};
  const listId = "areas-list";

  function updateLink(i: number, patch: Partial<LinkType>) {
    setLinks((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  return (
    <form action={formAction} className="space-y-5">
      {templateId && <input type="hidden" name="templateId" value={templateId} />}
      <div className="space-y-2">
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          name="title"
          required
          autoFocus={!initiative}
          defaultValue={d.title ?? ""}
          placeholder="e.g. Node.js hosting — MCP distribution"
          aria-invalid={Boolean(errors.title)}
        />
        {errors.title && <p className="text-sm text-destructive">{errors.title}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <MarkdownEditor
          id="description"
          name="description"
          defaultValue={d.description ?? ""}
          placeholder="What is this, why does it matter, what does done look like? Markdown with a toolbar."
          rows={5}
          aria-invalid={Boolean(errors.description)}
        />
        {errors.description && <p className="text-sm text-destructive">{errors.description}</p>}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="area">Area / tag</Label>
          <Input
            id="area"
            name="area"
            list={listId}
            defaultValue={d.area ?? ""}
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
          <Select name="status" value={status} onValueChange={(v) => setStatus(v as Status)}>
            <SelectTrigger id="status" className="w-full">
              <SelectValue>
                <span className="flex items-center gap-1.5">
                  <span className={cn("size-1.5 rounded-full", STATUS_STYLE[status].dot)} aria-hidden />
                  {STATUS_LABEL[status]}
                </span>
              </SelectValue>
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
          <Select name="priority" value={priority} onValueChange={(v) => setPriority(v as Priority)}>
            <SelectTrigger id="priority" className="w-full">
              <SelectValue>{PRIORITY_LABEL[priority]}</SelectValue>
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

      {status === "waiting" && (
        <div className="space-y-2">
          <Label htmlFor="waitingOn">Waiting on</Label>
          <Input id="waitingOn" name="waitingOn" defaultValue={initiative?.waitingOn ?? ""} placeholder="e.g. Legal, Jane, Ads API partner" maxLength={80} />
          <p className="text-xs text-muted-foreground">Shown on the card with how long it has been.</p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="checkInDays">Expect an update every</Label>
          <Select name="checkInDays" value={cadence} onValueChange={setCadence}>
            <SelectTrigger id="checkInDays" className="w-full">
              <SelectValue>{CADENCE_LABEL[cadence] ?? `${cadence} days`}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="default">7 days (default)</SelectItem>
              <SelectItem value="3">3 days</SelectItem>
              <SelectItem value="14">2 weeks</SelectItem>
              <SelectItem value="30">Month</SelectItem>
              <SelectItem value="90">Quarter</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">Flagged as stale after this long without an entry.</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="snoozedUntil">Snooze until</Label>
          <Input id="snoozedUntil" name="snoozedUntil" type="date" defaultValue={initiative?.snoozedUntil ?? ""} />
          <p className="text-xs text-muted-foreground">No stale nudges until then. Leave empty for none.</p>
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
