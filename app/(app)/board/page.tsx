import type { Metadata } from "next";
import Link from "next/link";
import { FolderKanban, Plus, X } from "lucide-react";
import { listAreas, listInitiatives } from "@/lib/queries";
import { KanbanBoard } from "@/components/kanban-board";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Board" };
export const dynamic = "force-dynamic";

export default async function BoardPage({ searchParams }: PageProps<"/board">) {
  const sp = await searchParams;
  const area = typeof sp.area === "string" && sp.area ? sp.area : undefined;
  const now = new Date();
  const [items, areas] = await Promise.all([listInitiatives({ area, sort: "activity" }), listAreas()]);

  if (items.length === 0 && !area) {
    return (
      <EmptyState
        icon={FolderKanban}
        title="Nothing on the board yet"
        description="Create an initiative and it appears in the Idea column. Drag cards between columns to change status; every move is logged."
        action={
          <Button asChild>
            <Link href="/initiatives/new">
              <Plus data-icon="inline-start" aria-hidden />
              Create your first initiative
            </Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Board</h1>
          <p className="text-sm text-muted-foreground">
            Drag cards between columns, or use a card&rsquo;s menu. Moves are written to the log.
          </p>
        </div>
        {areas.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5" aria-label="Filter by area">
            {areas.map((a) => {
              const active = a === area;
              return (
                <Link key={a} href={active ? "/board" : `/board?area=${encodeURIComponent(a)}`} aria-pressed={active} className="rounded-full focus-visible:outline-2 focus-visible:outline-ring">
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
      <KanbanBoard initiatives={items} now={now} />
    </div>
  );
}
