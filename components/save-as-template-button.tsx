"use client";

import { useTransition } from "react";
import { LayoutTemplate } from "lucide-react";
import { createTemplateFromInitiative } from "@/lib/actions";
import { Button } from "@/components/ui/button";

export function SaveAsTemplateButton({ initiativeId }: { initiativeId: string }) {
  const [pending, start] = useTransition();
  return (
    <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={() => start(async () => { await createTemplateFromInitiative(initiativeId); })}>
      <LayoutTemplate data-icon="inline-start" aria-hidden />
      {pending ? "Saving…" : "Save as template"}
    </Button>
  );
}
