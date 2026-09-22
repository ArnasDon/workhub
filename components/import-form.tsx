"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { CheckCircle2, FileJson, Upload } from "lucide-react";
import { importBackup, type ImportState } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const LABELS: Record<string, string> = { initiatives: "Initiatives", logEntries: "Log entries", tasks: "To-dos", relations: "Links between initiatives", templates: "Templates" };

export function ImportForm() {
  const [state, action, pending] = useActionState<ImportState, FormData>(importBackup, { ok: false });
  const [fileName, setFileName] = useState("");

  if (state.ok && state.report) {
    const total = Object.values(state.report).reduce((n, r) => n + r.inserted, 0);
    return (
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 size-5 text-status-done" aria-hidden />
          <div>
            <p className="font-medium">Restored {total} {total === 1 ? "record" : "records"}</p>
            <p className="text-sm text-muted-foreground">Rows that already existed were left untouched.</p>
          </div>
        </div>
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="py-1 font-medium">Type</th>
              <th className="py-1 text-right font-medium">Added</th>
              <th className="py-1 text-right font-medium">Skipped</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(state.report).map(([k, r]) => (
              <tr key={k} className="border-t">
                <td className="py-1.5">{LABELS[k]}</td>
                <td className="py-1.5 text-right tabular-nums">{r.inserted}</td>
                <td className="py-1.5 text-right tabular-nums text-muted-foreground">{r.skipped}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <Button asChild variant="outline" size="sm">
          <Link href="/">Go to the dashboard</Link>
        </Button>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="file">WorkHub JSON export</Label>
        <Input id="file" name="file" type="file" accept="application/json,.json" required onChange={(e) => setFileName(e.target.files?.[0]?.name ?? "")} />
        <p className="text-xs text-muted-foreground">The file from Export → JSON (backup). Older exports without to-dos or descriptions work too.</p>
      </div>

      {state.ok && state.summary && (
        <div className="rounded-lg border bg-muted/40 p-3 text-sm">
          <p className="mb-1 flex items-center gap-1.5 font-medium">
            <FileJson className="size-4" aria-hidden />
            {fileName || "File"} contains
          </p>
          <ul className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-muted-foreground sm:grid-cols-3">
            {Object.entries(state.summary).map(([k, n]) => (
              <li key={k}>
                <span className="tabular-nums text-foreground">{n}</span> {LABELS[k].toLowerCase()}
              </li>
            ))}
          </ul>
        </div>
      )}
      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" name="mode" value="preview" variant="outline" disabled={pending}>
          Check file
        </Button>
        <Button type="submit" name="mode" value="import" disabled={pending}>
          <Upload data-icon="inline-start" aria-hidden />
          {pending ? "Working…" : "Restore"}
        </Button>
      </div>
    </form>
  );
}
