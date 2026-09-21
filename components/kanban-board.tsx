"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { ArrowRightLeft, Ban, Clock, ExternalLink, GripVertical, MoreHorizontal, Pin } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { setStatus } from "@/lib/actions";
import { PRIORITY_DOT, PRIORITY_LABEL, STATUS_LABEL, STATUS_STYLE, type Status } from "@/lib/constants";
import type { InitiativeWithActivity } from "@/lib/queries";
import { isStale, relativeDays } from "@/lib/format";
import { plainText } from "@/lib/plain-text";
import { TaskProgress } from "@/components/task-progress";
import { openCapture } from "@/components/capture-events";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/** Board columns: every status except Archived (archive from the card menu or detail page). */
export const BOARD_STATUSES: Status[] = ["idea", "in_progress", "blocked", "waiting", "done"];

type Props = { initiatives: InitiativeWithActivity[]; now: Date };

export function KanbanBoard({ initiatives, now }: Props) {
  const router = useRouter();
  const [items, setItems] = useState(initiatives);
  const [source, setSource] = useState(initiatives);
  // Adopt fresh server data after router.refresh() without an effect.
  if (source !== initiatives) {
    setSource(initiatives);
    setItems(initiatives);
  }
  const [activeId, setActiveId] = useState<string | null>(null);
  const [, start] = useTransition();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );

  function move(id: string, to: Status) {
    const item = items.find((i) => i.id === id);
    if (!item || item.status === to) return;
    const from = item.status;
    setItems((list) => list.map((i) => (i.id === id ? { ...i, status: to } : i)));
    start(async () => {
      const res = await setStatus({ id, status: to });
      if (!res.ok) {
        setItems((list) => list.map((i) => (i.id === id ? { ...i, status: from } : i)));
        toast.error(res.error ?? "Could not move the initiative");
        return;
      }
      toast.success(`${item.title} → ${STATUS_LABEL[to]}`);
      router.refresh();
    });
  }

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }

  function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const over = e.over?.id;
    if (!over) return;
    const to = (BOARD_STATUSES as string[]).includes(String(over))
      ? (String(over) as Status)
      : items.find((i) => i.id === String(over))?.status;
    if (to) move(String(e.active.id), to);
  }

  const active = activeId ? items.find((i) => i.id === activeId) : null;

  return (
    <DndContext id="workhub-board" sensors={sensors} collisionDetection={closestCorners} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setActiveId(null)}>
      <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6" role="list" aria-label="Board columns">
        {BOARD_STATUSES.map((status) => (
          <Column key={status} status={status} items={items.filter((i) => i.status === status)} now={now} onMove={move} />
        ))}
      </div>
      <DragOverlay dropAnimation={null}>
        {active ? <BoardCard item={active} now={now} onMove={move} overlay /> : null}
      </DragOverlay>
    </DndContext>
  );
}

function Column({ status, items, now, onMove }: { status: Status; items: InitiativeWithActivity[]; now: Date; onMove: (id: string, to: Status) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <section
      ref={setNodeRef}
      role="listitem"
      aria-labelledby={`col-${status}`}
      className={cn(
        "flex min-h-[50vh] w-[280px] shrink-0 snap-start flex-col rounded-2xl border bg-muted/40 transition-colors sm:w-[300px]",
        isOver && "border-primary/50 bg-primary/5",
      )}
    >
      <header className="flex items-center gap-2 px-3 py-2.5">
        <span className={cn("size-2 rounded-full", STATUS_STYLE[status].dot)} aria-hidden />
        <h2 id={`col-${status}`} className="text-sm font-semibold">
          {STATUS_LABEL[status]}
        </h2>
        <span className="ml-auto rounded-full bg-background px-2 py-0.5 text-xs text-muted-foreground">{items.length}</span>
      </header>
      <div className="flex min-h-24 flex-1 flex-col gap-2 px-2 pb-2">
        {items.map((item) => (
          <DraggableCard key={item.id} item={item} now={now} onMove={onMove} />
        ))}
        {items.length === 0 && (
          <p className={cn("m-1 flex flex-1 items-center justify-center rounded-xl border border-dashed p-4 text-center text-xs text-muted-foreground", isOver && "border-primary/50 text-primary")}>
            {isOver ? "Release to move here" : "Nothing here"}
          </p>
        )}
      </div>
    </section>
  );
}

function DraggableCard({ item, now, onMove }: { item: InitiativeWithActivity; now: Date; onMove: (id: string, to: Status) => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: item.id, data: { status: item.status } });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={cn(isDragging && "opacity-40")}
    >
      <BoardCard item={item} now={now} onMove={onMove} handleProps={{ ...attributes, ...listeners }} />
    </div>
  );
}

function BoardCard({
  item,
  now,
  onMove,
  handleProps,
  overlay,
}: {
  item: InitiativeWithActivity;
  now: Date;
  onMove: (id: string, to: Status) => void;
  handleProps?: Record<string, unknown>;
  overlay?: boolean;
}) {
  const stale = item.status !== "done" && isStale(item.lastActivityAt, now);
  return (
    <article
      className={cn(
        "group flex flex-col gap-2 rounded-xl border bg-card p-3 shadow-xs",
        overlay && "rotate-1 shadow-lg ring-2 ring-primary/30",
        item.pinned && "border-primary/30",
      )}
    >
      <div className="flex items-start gap-1.5">
        <button
          type="button"
          className="-ml-1 mt-0.5 shrink-0 cursor-grab touch-none rounded text-muted-foreground/60 hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring active:cursor-grabbing"
          aria-label={`Drag ${item.title}`}
          {...handleProps}
        >
          <GripVertical className="size-4" aria-hidden />
        </button>
        <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", PRIORITY_DOT[item.priority])} aria-label={`${PRIORITY_LABEL[item.priority]} priority`} />
        <h3 className="min-w-0 flex-1 text-sm font-semibold leading-snug">
          <Link href={`/initiatives/${item.id}`} className="hover:underline underline-offset-4">
            {item.title}
          </Link>
        </h3>
        {item.pinned && <Pin className="mt-0.5 size-3.5 shrink-0 fill-current text-primary" aria-label="Pinned" />}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="ghost" size="icon-xs" aria-label={`Actions for ${item.title}`} className="-mr-1 -mt-0.5 text-muted-foreground">
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => openCapture({ initiativeId: item.id })}>Log update</DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={`/initiatives/${item.id}`}>Open</Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <ArrowRightLeft className="size-4" aria-hidden />
                Move to
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuLabel>Status</DropdownMenuLabel>
                {[...BOARD_STATUSES, "archived" as Status].map((s) => (
                  <DropdownMenuItem key={s} disabled={s === item.status} onSelect={() => onMove(item.id, s)}>
                    <span className={cn("size-1.5 rounded-full", STATUS_STYLE[s].dot)} aria-hidden />
                    {STATUS_LABEL[s]}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {item.latestEntry && <p className="line-clamp-2 text-xs text-muted-foreground">{plainText(item.latestEntry.body, 200)}</p>}
      {item.taskTotal > 0 && <TaskProgress done={item.taskDone} total={item.taskTotal} />}

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
        {item.area && <Badge variant="secondary" className="h-5 px-1.5 text-[11px] font-normal">{item.area}</Badge>}
        <span className={cn("inline-flex items-center gap-1", stale && "font-medium text-status-blocked")}>
          <Clock className="size-3" aria-hidden />
          {relativeDays(item.lastActivityAt, now)}
        </span>
        {item.links.length > 0 && (
          <span className="inline-flex items-center gap-0.5">
            <ExternalLink className="size-3" aria-hidden />
            {item.links.length}
          </span>
        )}
        {item.openBlockers > 0 && item.status !== "done" && (
          <span className="inline-flex items-center gap-0.5 font-medium text-status-blocked" title="Open blockers">
            <Ban className="size-3" aria-hidden />
            {item.openBlockers}
          </span>
        )}
      </div>
    </article>
  );
}
