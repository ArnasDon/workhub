"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

/**
 * Copies `text` to the clipboard. If the browser refuses (permissions,
 * embedded webviews, http origins), falls back to a dialog with the text
 * pre-selected so a manual ⌘C still works.
 */
export function CopyButton({ text, label = "Copy as Markdown" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const [fallback, setFallback] = useState(false);

  async function copy() {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard API unavailable");
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setFallback(true);
    }
  }

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={copy}>
        {copied ? <Check data-icon="inline-start" aria-hidden /> : <Copy data-icon="inline-start" aria-hidden />}
        {copied ? "Copied" : label}
      </Button>
      <Dialog open={fallback} onOpenChange={setFallback}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Copy the Markdown</DialogTitle>
            <DialogDescription>
              The browser blocked automatic copying. The text below is selected: press ⌘C (Ctrl+C on Windows).
            </DialogDescription>
          </DialogHeader>
          <Textarea
            readOnly
            value={text}
            rows={16}
            aria-label="Digest Markdown"
            className="font-mono text-xs"
            autoFocus
            onFocus={(e) => e.currentTarget.select()}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
