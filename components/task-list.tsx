"use client";

import { useOptimistic, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ListChecks, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Task } from "@/db/schema";
import { addTask, deleteTask, toggleTask, updateTask } from "@/lib/actions";
import { TaskProgress } from "@/components/task-progress";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";

type Change = { type: "toggle"; id: string; done: boolean } | { type: "delete"; id: string } | { type: "rename"; id: string; title: string };

export function TaskList({ initiativeId, tasks }: { initiativeId: string; tasks: Task[] }) {
  const router = useRouter();
  const [, start] = useTransition();
  const [optimistic, apply] = useOptimistic(tasks, (state: Task[], c: Change) => {
    if (c.type === "delete") return state.filter((t) => t.id !== c.id);
    return state.map((t) =>
      t.id !== c.id ? t : c.type === "toggle" ? { ...t, done: c.done, doneAt: c.done ? new Date() : null } : { ...t, title: c.title },
    );
  });
  const [draft, setDraft] = useState("");
  const [showDone, setShowDone] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const open = optimistic.filter((t) => !t.done);
  const done = optimistic.filter((t) => t.done);

  function run(action: () => Promise<{ ok: boolean; error?: string }>, change?: Change) {
    start(async () => {
      if (change) apply(change);
      const res = await action();
      if (!res.ok) toast.error(res.error ?? "Something went wrong");
      router.refresh();
    });
  }

  function add() {
    const title = draft.trim();
    if (!title) return;
    setDraft("");
    run(() => addTask({ initiativeId, title }));
    inputRef.current?.focus();
  }

  return (
    <section aria-labelledby="todo-heading" className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="todo-heading" className="flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          <ListChecks className="size-4" aria-hidden />
          To-do
        </h2>
        {optimistic.length > 0 && <TaskProgress done={done.length} total={optimistic.length} size="md" className="w-56 max-w-full" />}
      </div>

      <div className="rounded-xl border bg-card shadow-xs">
        {open.length === 0 && done.length === 0 && (
          <p className="px-3 pt-3 text-sm text-muted-foreground">Break the initiative into concrete steps. Checking one off is logged.</p>
        )}
        <ul className="divide-y">
          {open.map((t) => (
            <TaskRow key={t.id} task={t} onToggle={(d) => run(() => toggleTask({ id: t.id, done: d }), { type: "toggle", id: t.id, done: d })} onRename={(title) => run(() => updateTask({ id: t.id, title }), { type: "rename", id: t.id, title })} onDelete={() => run(() => deleteTask(t.id), { type: "delete", id: t.id })} />
          ))}
        </ul>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
          className="flex items-center gap-2 border-t px-3 py-2"
        >
          <Plus className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <Input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              // Explicit, so Enter works even where implicit form submission does not fire (some webviews, IME edge cases).
              if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                e.preventDefault();
                add();
              }
            }}
            placeholder="Add a to-do and press Enter"
            aria-label="New to-do"
            className="h-8 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
          />
          <Button type="submit" size="xs" variant="secondary" disabled={!draft.trim()}>
            Add
          </Button>
        </form>
      </div>

      {done.length > 0 && (
        <div className="rounded-xl border border-dashed bg-card/60">
          <button
            type="button"
            onClick={() => setShowDone((v) => !v)}
            aria-expanded={showDone}
            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ChevronDown className={cn("size-4 transition-transform", !showDone && "-rotate-90")} aria-hidden />
            Completed ({done.length})
          </button>
          {showDone && (
            <ul className="divide-y border-t">
              {done.map((t) => (
                <TaskRow key={t.id} task={t} onToggle={(d) => run(() => toggleTask({ id: t.id, done: d }), { type: "toggle", id: t.id, done: d })} onRename={(title) => run(() => updateTask({ id: t.id, title }), { type: "rename", id: t.id, title })} onDelete={() => run(() => deleteTask(t.id), { type: "delete", id: t.id })} />
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

function TaskRow({
  task,
  onToggle,
  onRename,
  onDelete,
}: {
  task: Task;
  onToggle: (done: boolean) => void;
  onRename: (title: string) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(task.title);

  function commit() {
    setEditing(false);
    const next = value.trim();
    if (!next || next === task.title) {
      setValue(task.title);
      return;
    }
    onRename(next);
  }

  return (
    <li className="group flex items-center gap-3 px-3 py-2">
      <Checkbox
        checked={task.done}
        onCheckedChange={(v) => onToggle(v === true)}
        aria-label={task.done ? `Mark “${task.title}” as not done` : `Mark “${task.title}” as done`}
      />
      {editing ? (
        <Input
          autoFocus
          value={value}
          onFocus={(e) => e.currentTarget.select()}
          onChange={(e) => setValue(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") {
              setValue(task.title);
              setEditing(false);
            }
          }}
          aria-label="Edit to-do"
          className="h-7 flex-1 px-1"
        />
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          title="Click to edit"
          className={cn("min-w-0 flex-1 truncate text-left text-sm hover:underline underline-offset-4 decoration-border", task.done && "text-muted-foreground line-through")}
        >
          {task.title}
        </button>
      )}
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        aria-label={`Delete “${task.title}”`}
        onClick={onDelete}
        className="text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
      >
        <Trash2 className="size-3.5" />
      </Button>
    </li>
  );
}
