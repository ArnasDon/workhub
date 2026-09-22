import { differenceInCalendarDays, format } from "date-fns";
import type { Digest } from "@/lib/queries";
import { STATUS_LABEL } from "@/lib/constants";

export function digestRangeLabel(d: Digest): string {
  const sameMonth = d.since.getMonth() === d.until.getMonth();
  return `${format(d.since, sameMonth ? "d" : "d MMM")}–${format(d.until, "d MMM yyyy")}`;
}

/** The digest as Markdown, ready to paste into Slack, a doc, or a 1:1 note. */
export function digestToMarkdown(d: Digest): string {
  const out: string[] = [];
  out.push(`# WorkHub digest · ${digestRangeLabel(d)}`, "");
  out.push(
    `_${d.entryCount} ${d.entryCount === 1 ? "update" : "updates"} across ${d.groups.length} ${d.groups.length === 1 ? "initiative" : "initiatives"} in the last ${d.days} days._`,
    "",
  );

  for (const g of d.groups) {
    const meta = [STATUS_LABEL[g.initiative.status], g.initiative.area].filter(Boolean).join(" · ");
    out.push(`## ${g.initiative.title}${meta ? ` (${meta})` : ""}`, "");
    for (const e of g.entries) {
      const lines = e.body.trim().split("\n");
      const tag = e.kind === "decision" ? "Decision: " : e.kind === "blocker" ? "Blocker: " : "";
      out.push(`- **${format(e.createdAt, "EEE d MMM")}** — ${tag}${lines[0]}`);
      for (const l of lines.slice(1)) out.push(`  ${l}`);
    }
    out.push("");
  }

  if (d.completed.length) {
    out.push(`## Completed`, "");
    for (const i of d.completed) out.push(`- ${i.title}${i.area ? ` (${i.area})` : ""}`);
    out.push("");
  }
  if (d.created.length) {
    out.push(`## New this period`, "");
    for (const i of d.created) out.push(`- ${i.title} — ${STATUS_LABEL[i.status]}${i.area ? `, ${i.area}` : ""}`);
    out.push("");
  }
  if (d.waiting.length) {
    out.push(`## Waiting on others`, "");
    for (const i of d.waiting) {
      const days = i.waitingSince ? differenceInCalendarDays(d.until, i.waitingSince) : null;
      out.push(`- ${i.title} — ${i.waitingOn ? `waiting on ${i.waitingOn}` : "waiting"}${days !== null ? `, ${days}d` : ""}`);
    }
    out.push("");
  }
  if (d.quiet.length) {
    out.push(`## Gone quiet (no update in ${d.days}+ days)`, "");
    for (const i of d.quiet) {
      const days = differenceInCalendarDays(d.until, i.lastActivityAt);
      out.push(`- ${i.title} — ${STATUS_LABEL[i.status]}, last update ${days}d ago`);
    }
    out.push("");
  }
  return out.join("\n").trimEnd() + "\n";
}
