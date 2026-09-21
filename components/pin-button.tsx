"use client";

import { useOptimistic, useTransition } from "react";
import { Pin, PinOff } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { togglePinned } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function PinButton({ id, pinned, className }: { id: string; pinned: boolean; className?: string }) {
  const [optimistic, setOptimistic] = useOptimistic(pinned);
  const [, start] = useTransition();

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-pressed={optimistic}
          aria-label={optimistic ? "Unpin" : "Pin to top"}
          className={cn(optimistic ? "text-primary" : "text-muted-foreground", className)}
          onClick={() =>
            start(async () => {
              setOptimistic(!optimistic);
              const res = await togglePinned(id);
              if (!res.ok) toast.error(res.error ?? "Could not update pin");
            })
          }
        >
          {optimistic ? <Pin className="size-4 fill-current" /> : <PinOff className="size-4" />}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{optimistic ? "Unpin" : "Pin to top"}</TooltipContent>
    </Tooltip>
  );
}
