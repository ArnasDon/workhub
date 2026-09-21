"use client";

import { useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { Bold, Code, Eye, Heading2, Italic, Link2, List, ListChecks, ListOrdered, PencilLine, Quote, Strikethrough } from "lucide-react";
import { cn } from "@/lib/utils";
import { Markdown } from "@/components/markdown";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type Props = {
  name: string;
  defaultValue?: string;
  placeholder?: string;
  rows?: number;
  id?: string;
  "aria-invalid"?: boolean;
  className?: string;
};

type Tool = { label: string; icon: typeof Bold; shortcut?: string; run: (s: Selection) => Selection };
type Selection = { text: string; start: number; end: number };

/** Wrap the selection (or insert a placeholder) with before/after markers. */
function wrap(before: string, after = before, placeholder = "text"): Tool["run"] {
  return ({ text, start, end }) => {
    const selected = text.slice(start, end) || placeholder;
    const next = text.slice(0, start) + before + selected + after + text.slice(end);
    return { text: next, start: start + before.length, end: start + before.length + selected.length };
  };
}

/** Prefix every selected line (or the current line). `numbered` renumbers 1., 2., … */
function prefixLines(prefix: string, numbered = false): Tool["run"] {
  return ({ text, start, end }) => {
    const lineStart = text.lastIndexOf("\n", start - 1) + 1;
    const lineEndIdx = text.indexOf("\n", end);
    const lineEnd = lineEndIdx === -1 ? text.length : lineEndIdx;
    const block = text.slice(lineStart, lineEnd);
    const lines = block.split("\n").map((l, i) => (numbered ? `${i + 1}. ${l}` : `${prefix}${l}`));
    const replaced = lines.join("\n");
    const next = text.slice(0, lineStart) + replaced + text.slice(lineEnd);
    // Caret at the end of the block: the user keeps typing instead of overwriting what was just prefixed.
    const caret = lineStart + replaced.length;
    return { text: next, start: caret, end: caret };
  };
}

const TOOLS: Tool[] = [
  { label: "Bold", icon: Bold, shortcut: "b", run: wrap("**") },
  { label: "Italic", icon: Italic, shortcut: "i", run: wrap("_") },
  { label: "Strikethrough", icon: Strikethrough, run: wrap("~~") },
  { label: "Heading", icon: Heading2, run: prefixLines("## ") },
  { label: "Bullet list", icon: List, run: prefixLines("- ") },
  { label: "Numbered list", icon: ListOrdered, run: prefixLines("", true) },
  { label: "Task list", icon: ListChecks, run: prefixLines("- [ ] ") },
  { label: "Quote", icon: Quote, run: prefixLines("> ") },
  { label: "Code", icon: Code, run: wrap("`", "`", "code") },
  { label: "Link", icon: Link2, shortcut: "k", run: ({ text, start, end }) => {
      const selected = text.slice(start, end) || "link text";
      const insert = `[${selected}](https://)`;
      const next = text.slice(0, start) + insert + text.slice(end);
      const urlStart = start + selected.length + 3;
      return { text: next, start: urlStart, end: urlStart + 8 };
    } },
];

/**
 * Markdown textarea with a formatting toolbar and a preview tab. Uncontrolled
 * from the form's point of view: the textarea carries `name`, so FormData
 * picks it up like any other field.
 */
export function MarkdownEditor({ name, defaultValue = "", placeholder, rows = 6, id, className, ...rest }: Props) {
  const [value, setValue] = useState(defaultValue);
  const [mode, setMode] = useState<"write" | "preview">("write");
  const ref = useRef<HTMLTextAreaElement>(null);
  const pendingSelection = useRef<{ start: number; end: number } | null>(null);
  const autoId = useId();
  const textareaId = id ?? autoId;

  // Apply the selection right after the new value has been committed to the DOM, before any further keystroke.
  useLayoutEffect(() => {
    const sel = pendingSelection.current;
    const el = ref.current;
    if (!sel || !el) return;
    pendingSelection.current = null;
    el.focus();
    el.setSelectionRange(sel.start, sel.end);
  }, [value]);

  function apply(tool: Tool) {
    const el = ref.current;
    const sel: Selection = el ? { text: value, start: el.selectionStart, end: el.selectionEnd } : { text: value, start: value.length, end: value.length };
    const next = tool.run(sel);
    pendingSelection.current = { start: next.start, end: next.end };
    setValue(next.text);
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (!(e.metaKey || e.ctrlKey)) return;
    const tool = TOOLS.find((t) => t.shortcut === e.key.toLowerCase());
    if (tool) {
      e.preventDefault();
      apply(tool);
    }
  }

  return (
    <div className={cn("rounded-lg border bg-card shadow-xs focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/30", className)}>
      <div className="flex flex-wrap items-center gap-0.5 border-b px-1.5 py-1">
        {TOOLS.map((t) => (
          <Tooltip key={t.label}>
            <TooltipTrigger asChild>
              <Button type="button" variant="ghost" size="icon-xs" aria-label={t.label} disabled={mode === "preview"} onMouseDown={(e) => e.preventDefault()} onClick={() => apply(t)}>
                <t.icon className="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {t.label}
              {t.shortcut && <kbd className="ml-1.5 rounded bg-muted px-1 font-mono text-[10px] text-muted-foreground">⌘{t.shortcut.toUpperCase()}</kbd>}
            </TooltipContent>
          </Tooltip>
        ))}
        <div role="tablist" aria-label="Editor mode" className="ml-auto inline-flex rounded-md bg-muted p-0.5 text-xs">
          {(["write", "preview"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              onClick={() => setMode(m)}
              className={cn("inline-flex items-center gap-1 rounded px-2 py-0.5 capitalize transition-colors", mode === m ? "bg-card font-medium shadow-xs" : "text-muted-foreground hover:text-foreground")}
            >
              {m === "write" ? <PencilLine className="size-3" aria-hidden /> : <Eye className="size-3" aria-hidden />}
              {m}
            </button>
          ))}
        </div>
      </div>
      {/* The textarea stays mounted in preview so the form always submits the value. */}
      <Textarea
        ref={ref}
        id={textareaId}
        name={name}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        rows={rows}
        className={cn("resize-y rounded-none border-0 bg-transparent shadow-none focus-visible:ring-0", mode === "preview" && "hidden")}
        {...rest}
      />
      {mode === "preview" && (
        <div className="min-h-24 px-3 py-2 text-sm">
          {value.trim() ? <Markdown text={value} /> : <p className="text-muted-foreground">Nothing to preview yet.</p>}
        </div>
      )}
    </div>
  );
}
