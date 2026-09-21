"use client";

import { useCallback, useEffect, useRef, useState, useTransition, type ComponentProps } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Command as CommandIcon, CornerDownLeft, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { addLogEntry } from "@/lib/actions";
import { STATUS_LABEL, STATUS_STYLE, type Status } from "@/lib/constants";
import { CAPTURE_EVENT, openCapture, type CaptureDetail } from "@/components/capture-events";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";

export type InitiativeOption = { id: string; title: string; area: string; status: Status };

export function OpenPaletteButton(props: ComponentProps<typeof Button>) {
  return (
    <Button type="button" variant="ghost" size="icon-sm" aria-label="Quick capture (⌘K)" onClick={() => openCapture()} {...props}>
      <CommandIcon className="size-4" />
    </Button>
  );
}

/**
 * ⌘K palette. Pick an initiative → type an update → ⌘Enter. Also jumps to
 * initiatives, runs a search, or starts a new initiative. Mounted once in the
 * app layout; any "Log update" button opens it via a window event.
 */
export function QuickCapture({ initiatives }: { initiatives: InitiativeOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [target, setTarget] = useState<InitiativeOption | null>(null);
  const [body, setBody] = useState("");
  const [pending, start] = useTransition();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const reset = useCallback(() => {
    setTarget(null);
    setBody("");
    setQuery("");
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }
    function onCapture(e: Event) {
      const detail = (e as CustomEvent<CaptureDetail>).detail ?? {};
      const found = detail.initiativeId ? initiatives.find((i) => i.id === detail.initiativeId) ?? null : null;
      setTarget(found);
      setBody("");
      setQuery("");
      setOpen(true);
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener(CAPTURE_EVENT, onCapture);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(CAPTURE_EVENT, onCapture);
    };
  }, [initiatives]);

  useEffect(() => {
    if (open && target) requestAnimationFrame(() => textareaRef.current?.focus());
  }, [open, target]);

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next) reset();
  }

  function submit() {
    if (!target || !body.trim()) return;
    start(async () => {
      const res = await addLogEntry({ initiativeId: target.id, body });
      if (!res.ok) {
        toast.error(res.error ?? "Could not save the update");
        return;
      }
      toast.success(`Logged to ${target.title}`);
      onOpenChange(false);
      router.refresh();
    });
  }

  function go(href: string) {
    onOpenChange(false);
    router.push(href);
  }

  const trimmed = query.trim();

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title={target ? `Log update · ${target.title}` : "Quick capture"}
      description={target ? "Write the update and press ⌘Enter" : "Pick an initiative to log an update, or jump anywhere"}
      className="sm:max-w-xl"
    >
      {target ? (
        <div className="flex flex-col gap-3 p-3">
          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" size="icon-sm" aria-label="Back to list" onClick={() => setTarget(null)}>
              <ArrowLeft className="size-4" />
            </Button>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{target.title}</p>
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className={cn("size-1.5 rounded-full", STATUS_STYLE[target.status].dot)} aria-hidden />
                {STATUS_LABEL[target.status]}
                {target.area && <> · {target.area}</>}
              </p>
            </div>
          </div>
          <Textarea
            ref={textareaRef}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault();
                submit();
              }
            }}
            placeholder="What happened? What did you decide? What's next?"
            aria-label="Update"
            rows={5}
            className="min-h-28 resize-y bg-background text-sm"
          />
          <div className="flex items-center justify-between gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => go(`/initiatives/${target.id}`)}>
              Open initiative
            </Button>
            <Button type="button" size="sm" disabled={pending || !body.trim()} onClick={submit}>
              {pending ? "Saving…" : "Log update"}
              <CornerDownLeft data-icon="inline-end" aria-hidden className="opacity-70" />
            </Button>
          </div>
        </div>
      ) : (
        <>
          <CommandInput value={query} onValueChange={setQuery} placeholder="Type an initiative name…" />
          <CommandList>
            <CommandEmpty>Nothing matches. Try a different word.</CommandEmpty>
            <CommandGroup heading="Log an update to">
              {initiatives.map((i) => (
                <CommandItem
                  key={i.id}
                  value={`${i.title} ${i.area}`}
                  onSelect={() => setTarget(i)}
                  className="gap-2"
                >
                  <span className={cn("size-1.5 shrink-0 rounded-full", STATUS_STYLE[i.status].dot)} aria-hidden />
                  <span className="truncate">{i.title}</span>
                  {i.area && <span className="ml-auto truncate text-xs text-muted-foreground">{i.area}</span>}
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading="Actions">
              <CommandItem value="new initiative create add" onSelect={() => go("/initiatives/new")}>
                <Plus aria-hidden />
                New initiative
              </CommandItem>
              {trimmed && (
                <CommandItem value={`search ${trimmed}`} onSelect={() => go(`/?q=${encodeURIComponent(trimmed)}`)}>
                  <Search aria-hidden />
                  Search log for &ldquo;{trimmed}&rdquo;
                </CommandItem>
              )}
            </CommandGroup>
          </CommandList>
        </>
      )}
    </CommandDialog>
  );
}
