"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { setStatus } from "@/lib/actions";
import { STATUSES, STATUS_LABEL, STATUS_STYLE, type Status } from "@/lib/constants";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/** Inline status control used in list rows and the detail header. Logs the transition. */
export function StatusSelect({
  id,
  status,
  size = "sm",
  className,
}: {
  id: string;
  status: Status;
  size?: "sm" | "default";
  className?: string;
}) {
  const [value, setValue] = useState<Status>(status);
  const [pending, start] = useTransition();

  function onChange(next: string) {
    const prev = value;
    setValue(next as Status);
    start(async () => {
      const res = await setStatus({ id, status: next });
      if (!res.ok) {
        setValue(prev);
        toast.error(res.error ?? "Could not change status");
      } else {
        toast.success(`Marked ${STATUS_LABEL[next as Status]}`);
      }
    });
  }

  return (
    <Select value={value} onValueChange={onChange} disabled={pending}>
      <SelectTrigger
        size={size}
        aria-label="Status"
        className={cn("h-7 gap-1.5 border-transparent bg-transparent pl-2 pr-1.5 shadow-none", STATUS_STYLE[value].badge, className)}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end">
        {STATUSES.map((s) => (
          <SelectItem key={s} value={s}>
            <span className={cn("size-1.5 rounded-full", STATUS_STYLE[s].dot)} aria-hidden />
            {STATUS_LABEL[s]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
