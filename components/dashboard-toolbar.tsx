"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Archive, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { GROUPINGS, SORTS, SORT_LABEL, type Grouping, type Sort } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Props = { grouping: Grouping; sort: Sort; area?: string; archived: boolean; areas: string[] };

export function DashboardToolbar({ grouping, sort, area, archived, areas }: Props) {
  const router = useRouter();
  const sp = useSearchParams();

  function withParams(patch: Record<string, string | null>) {
    const next = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === "") next.delete(k);
      else next.set(k, v);
    }
    const qs = next.toString();
    return qs ? `/?${qs}` : "/";
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Group by" className="inline-flex rounded-lg border bg-card p-0.5">
          {GROUPINGS.map((g) => (
            <Link
              key={g}
              href={withParams({ group: g === "status" ? null : g })}
              aria-current={grouping === g ? "page" : undefined}
              className={cn(
                "rounded-md px-2.5 py-1 text-sm capitalize transition-colors",
                grouping === g ? "bg-secondary font-medium text-secondary-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              By {g}
            </Link>
          ))}
        </div>

        <Select value={sort} onValueChange={(v) => router.push(withParams({ sort: v === "activity" ? null : v }))}>
          <SelectTrigger size="sm" aria-label="Sort by" className="w-[150px] bg-card">
            <span className="text-muted-foreground">Sort:</span>
            <SelectValue>{SORT_LABEL[sort]}</SelectValue>
          </SelectTrigger>
          <SelectContent position="popper">
            {SORTS.map((s) => (
              <SelectItem key={s} value={s}>
                {SORT_LABEL[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          asChild
          variant={archived ? "secondary" : "ghost"}
          size="sm"
          className="text-muted-foreground"
          aria-pressed={archived}
        >
          <Link href={withParams({ archived: archived ? null : "1" })}>
            <Archive data-icon="inline-start" aria-hidden />
            {archived ? "Hiding archived" : "Show archived"}
          </Link>
        </Button>
      </div>

      {areas.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5" aria-label="Filter by area">
          {areas.map((a) => {
            const active = a === area;
            return (
              <Link key={a} href={withParams({ area: active ? null : a })} aria-pressed={active} className="rounded-full focus-visible:outline-2 focus-visible:outline-ring">
                <Badge variant={active ? "default" : "secondary"} className={cn("gap-1 font-normal", !active && "hover:bg-accent")}>
                  {a}
                  {active && <X className="size-3" aria-hidden />}
                </Badge>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
