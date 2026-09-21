"use client";

import { MessageSquarePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { openCapture } from "@/components/capture-events";

export function LogUpdateButton({
  initiativeId,
  variant = "outline",
  size = "sm",
  label = "Log update",
  className,
}: {
  initiativeId: string;
  variant?: "outline" | "default" | "ghost" | "secondary";
  size?: "sm" | "default" | "xs";
  label?: string;
  className?: string;
}) {
  return (
    <Button type="button" variant={variant} size={size} className={className} onClick={() => openCapture({ initiativeId })}>
      <MessageSquarePlus data-icon="inline-start" aria-hidden />
      {label}
    </Button>
  );
}
