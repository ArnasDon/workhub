import { NextResponse, type NextRequest } from "next/server";
import { format } from "date-fns";
import { requireUser } from "@/lib/auth";
import { exportAll } from "@/lib/queries";
import { STATUS_LABEL, PRIORITY_LABEL } from "@/lib/constants";

export const dynamic = "force-dynamic";

/**
 * GET /api/export?format=json|md
 * Your backup and exit ramp: everything, in a format you can read without this app.
 */
export async function GET(request: NextRequest) {
  await requireUser();
  const fmt = request.nextUrl.searchParams.get("format") === "md" ? "md" : "json";
  const data = await exportAll();
  const stamp = format(new Date(), "yyyy-MM-dd-HHmm");

  if (fmt === "json") {
    return new NextResponse(JSON.stringify(data, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="workhub-export-${stamp}.json"`,
        "Cache-Control": "no-store",
      },
    });
  }

  const entriesByInitiative = new Map<string, typeof data.logEntries>();
  for (const e of data.logEntries) {
    const list = entriesByInitiative.get(e.initiativeId) ?? [];
    list.push(e);
    entriesByInitiative.set(e.initiativeId, list);
  }

  const lines: string[] = [`# WorkHub export`, ``, `Exported ${data.exportedAt}`, ``];
  for (const i of data.initiatives) {
    lines.push(`## ${i.title}`, ``);
    lines.push(`- Status: ${STATUS_LABEL[i.status]}`);
    lines.push(`- Priority: ${PRIORITY_LABEL[i.priority]}`);
    if (i.area) lines.push(`- Area: ${i.area}`);
    if (i.targetDate) lines.push(`- Target: ${i.targetDate}`);
    if (i.pinned) lines.push(`- Pinned`);
    for (const l of i.links) lines.push(`- [${l.label}](${l.url})`);
    lines.push(`- Created: ${i.createdAt.toISOString()}`, ``);
    const entries = entriesByInitiative.get(i.id) ?? [];
    if (entries.length) {
      lines.push(`### Log`, ``);
      for (const e of entries) {
        lines.push(`**${format(e.createdAt, "yyyy-MM-dd HH:mm")}**`, ``, e.body, ``);
      }
    }
  }

  return new NextResponse(lines.join("\n"), {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="workhub-export-${stamp}.md"`,
      "Cache-Control": "no-store",
    },
  });
}
