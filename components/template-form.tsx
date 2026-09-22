"use client";

import { useActionState, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { Link as LinkType, Priority, Status, Template } from "@/db/schema";
import { PRIORITIES, PRIORITY_LABEL, STATUSES, STATUS_LABEL, STATUS_STYLE } from "@/lib/constants";
import type { ActionState } from "@/lib/actions";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MarkdownEditor } from "@/components/markdown-editor";

type Props = {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  template?: Template;
  areas: string[];
  submitLabel: string;
  onSaved?: () => void;
};

const CADENCE_LABEL: Record<string, string> = { default: "7 days (default)", "3": "3 days", "14": "2 weeks", "30": "Month", "90": "Quarter" };

export function TemplateForm({ action, template, areas, submitLabel, onSaved }: Props) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    async (prev, fd) => {
      const res = await action(prev, fd);
      if (res.ok) onSaved?.();
      return res;
    },
    { ok: false },
  );
  const [links, setLinks] = useState<LinkType[]>(template?.links ?? []);
  const [status, setStatus] = useState<Status>(template?.status ?? "idea");
  const [priority, setPriority] = useState<Priority>(template?.priority ?? "medium");
  const [cadence, setCadence] = useState<string>(template?.checkInDays ? String(template.checkInDays) : "default");
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="name">Template name</Label>
        <Input id="name" name="name" required autoFocus={!template} defaultValue={template?.name ?? ""} placeholder="e.g. Q4 launch, Integration partner, Listing refresh" aria-invalid={Boolean(errors.name)} />
        {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description skeleton</Label>
        <MarkdownEditor id="description" name="description" defaultValue={template?.description ?? ""} rows={5} placeholder="Headings and prompts you want every initiative of this kind to start with." />
      </div>

      <div className="space-y-2">
        <Label htmlFor="tasks">To-dos (one per line)</Label>
        <Textarea id="tasks" name="tasks" rows={6} defaultValue={(template?.tasks ?? []).join("\n")} placeholder={"Write the PRD\nAlign with design\nShip behind a flag"} className="resize-y font-mono text-sm" />
        <p className="text-xs text-muted-foreground">Copied onto every initiative created from this template.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="area">Area / tag</Label>
          <Input id="area" name="area" list="template-areas" defaultValue={template?.area ?? ""} autoComplete="off" />
          <datalist id="template-areas">
            {areas.map((a) => (
              <option key={a} value={a} />
            ))}
          </datalist>
        </div>
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
        </div>
        <div className="space-y-2">
          <Label htmlFor="status">Starting status</Label>
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
              {STATUSES.filter((s) => s !== "archived").map((s) => (
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

      <fieldset className="space-y-2">
        <div className="flex items-center justify-between">
          <legend className="text-sm font-medium">Links</legend>
          <Button type="button" variant="ghost" size="xs" onClick={() => setLinks((ls) => [...ls, { label: "", url: "" }])}>
            <Plus data-icon="inline-start" aria-hidden />
            Add link
          </Button>
        </div>
        <div className="space-y-2">
          {links.map((l, i) => (
            <div key={i} className="flex gap-2">
              <Input aria-label={`Link ${i + 1} label`} placeholder="Label" value={l.label} onChange={(e) => setLinks((ls) => ls.map((x, idx) => (idx === i ? { ...x, label: e.target.value } : x)))} className="w-1/3" />
              <Input aria-label={`Link ${i + 1} URL`} placeholder="https://…" type="url" value={l.url} onChange={(e) => setLinks((ls) => ls.map((x, idx) => (idx === i ? { ...x, url: e.target.value } : x)))} className="flex-1" />
              <Button type="button" variant="ghost" size="icon-sm" aria-label={`Remove link ${i + 1}`} onClick={() => setLinks((ls) => ls.filter((_, idx) => idx !== i))}>
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
        </div>
        <input type="hidden" name="links" value={JSON.stringify(links)} />
      </fieldset>

      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
