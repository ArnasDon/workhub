import { Database } from "lucide-react";
import type { DbProblem } from "@/lib/db-error";

/** Rendered by the app layout when the very first query fails, instead of a blank 500. */
export function DatabaseProblem({ problem }: { problem: DbProblem }) {
  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-4 py-16">
      <div className="rounded-2xl border bg-card p-6 shadow-xs">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-status-blocked/10 text-status-blocked">
            <Database className="size-5" aria-hidden />
          </span>
          <div className="space-y-2">
            <h1 className="text-lg font-semibold">{problem.title}</h1>
            <p className="text-sm text-muted-foreground">{problem.detail}</p>
            <p className="text-sm">
              <span className="font-medium">Fix: </span>
              {problem.fix}
            </p>
            {problem.code && (
              <p className="text-xs text-muted-foreground">
                Error code <code className="rounded bg-muted px-1">{problem.code}</code>
              </p>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
