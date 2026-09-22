"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Keyboard } from "lucide-react";
import { openCapture } from "@/components/capture-events";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/**
 * Linear-style keyboard navigation over anything marked `data-kb-card={id}`:
 * dashboard cards, board cards, timeline rows.
 *   j / k        next / previous card        Enter, o, e   open
 *   s            focus the status menu       l             log an update
 *   p            toggle pin                  n             new initiative
 *   /            focus search                ?             this help
 *   g then l/b/t/d/c   go to list / board / timeline / digest / decisions
 * Ignored while typing or while a dialog or menu is open.
 */
export function KeyboardNav() {
  const router = useRouter();
  const pathname = usePathname();
  const [help, setHelp] = useState(false);
  const index = useRef(-1);
  const chord = useRef<{ key: string; at: number } | null>(null);

  useEffect(() => {
    index.current = -1;
    document.querySelectorAll("[data-kb-active]").forEach((el) => el.removeAttribute("data-kb-active"));
  }, [pathname]);

  useEffect(() => {
    const cards = () => Array.from(document.querySelectorAll<HTMLElement>("[data-kb-card]"));

    function activate(i: number) {
      const list = cards();
      if (list.length === 0) return;
      const next = Math.max(0, Math.min(list.length - 1, i));
      list.forEach((el) => el.removeAttribute("data-kb-active"));
      const el = list[next];
      el.setAttribute("data-kb-active", "true");
      el.scrollIntoView({ block: "nearest", behavior: "smooth" });
      index.current = next;
    }

    function current(): HTMLElement | null {
      const list = cards();
      return index.current >= 0 ? (list[index.current] ?? null) : null;
    }

    function typing(target: EventTarget | null) {
      const el = target as HTMLElement | null;
      return Boolean(
        el?.closest?.('input, textarea, select, [contenteditable="true"], [role="dialog"], [role="listbox"], [role="menu"], [cmdk-root]'),
      );
    }

    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (typing(e.target)) return;
      if (document.querySelector('[role="dialog"][data-state="open"]')) return;

      // "g" chords
      if (chord.current && Date.now() - chord.current.at < 1500) {
        const target = { l: "/", b: "/board", t: "/timeline", d: "/digest", c: "/decisions", n: "/initiatives/new" }[e.key];
        chord.current = null;
        if (target) {
          e.preventDefault();
          router.push(target);
          return;
        }
      }

      switch (e.key) {
        case "g":
          chord.current = { key: "g", at: Date.now() };
          return;
        case "j":
          e.preventDefault();
          activate(index.current + 1);
          return;
        case "k":
          e.preventDefault();
          activate(index.current - 1);
          return;
        case "Enter":
        case "o":
        case "e": {
          const el = current();
          const href = el?.querySelector<HTMLAnchorElement>('a[href^="/initiatives/"]')?.getAttribute("href");
          if (href) {
            e.preventDefault();
            router.push(href);
          }
          return;
        }
        case "s": {
          const btn = current()?.querySelector<HTMLElement>('[aria-label="Status"]');
          if (btn) {
            e.preventDefault();
            btn.focus();
          }
          return;
        }
        case "l": {
          const id = current()?.dataset.kbCard;
          if (id) {
            e.preventDefault();
            openCapture({ initiativeId: id });
          }
          return;
        }
        case "p": {
          const btn = current()?.querySelector<HTMLElement>("[aria-pressed]");
          if (btn) {
            e.preventDefault();
            btn.click();
          }
          return;
        }
        case "n":
          e.preventDefault();
          router.push("/initiatives/new");
          return;
        case "/": {
          const search = document.querySelector<HTMLInputElement>('input[type="search"]');
          if (search) {
            e.preventDefault();
            search.focus();
            search.select();
          }
          return;
        }
        case "?":
          e.preventDefault();
          setHelp(true);
          return;
        case "Escape":
          cards().forEach((el) => el.removeAttribute("data-kb-active"));
          index.current = -1;
          return;
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  return (
    <Dialog open={help} onOpenChange={setHelp}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="size-4" aria-hidden />
            Keyboard shortcuts
          </DialogTitle>
          <DialogDescription>Work the list without touching the mouse. Press ? any time to see this.</DialogDescription>
        </DialogHeader>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
          {SHORTCUTS.map(([keys, label]) => (
            <div key={label} className="contents">
              <dt className="flex gap-1">
                {keys.split(" ").map((k) => (
                  <kbd key={k} className="rounded border bg-muted px-1.5 font-mono text-xs">
                    {k}
                  </kbd>
                ))}
              </dt>
              <dd className="text-muted-foreground">{label}</dd>
            </div>
          ))}
        </dl>
      </DialogContent>
    </Dialog>
  );
}

const SHORTCUTS: [string, string][] = [
  ["j k", "Next / previous card"],
  ["Enter", "Open the selected initiative"],
  ["s", "Focus its status menu (then Space to open)"],
  ["l", "Log an update to it"],
  ["p", "Pin or unpin it"],
  ["n", "New initiative"],
  ["/", "Search"],
  ["⌘K", "Quick capture and jump anywhere"],
  ["g l", "Go to list"],
  ["g b", "Go to board"],
  ["g t", "Go to timeline"],
  ["g d", "Go to digest"],
  ["g c", "Go to decisions"],
  ["?", "This help"],
];
