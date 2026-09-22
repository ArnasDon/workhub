"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlarmClockOff, BellOff } from "lucide-react";
import { toast } from "sonner";
import { setSnooze } from "@/lib/actions";
import { snoozeLabel } from "@/lib/format";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const OPTIONS: { label: string; days: number }[] = [
  { label: "1 week", days: 7 },
  { label: "2 weeks", days: 14 },
  { label: "1 month", days: 30 },
  { label: "3 months", days: 90 },
];

function plusDays(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function SnoozeMenu({ id, snoozedUntil, now }: { id: string; snoozedUntil: string | null; now: Date }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const active = snoozedUntil && new Date(`${snoozedUntil}T00:00:00`) >= new Date(now.toDateString());

  function apply(until: string | null) {
    start(async () => {
      const res = await setSnooze({ id, until });
      if (!res.ok) toast.error(res.error ?? "Could not snooze");
      else toast.success(until ? `Snoozed until ${until}` : "Snooze cleared");
      router.refresh();
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant={active ? "secondary" : "outline"} size="sm" disabled={pending}>
          {active ? <AlarmClockOff data-icon="inline-start" aria-hidden /> : <BellOff data-icon="inline-start" aria-hidden />}
          {active ? snoozeLabel(snoozedUntil, now) : "Snooze"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Hide stale nudges for</DropdownMenuLabel>
        {OPTIONS.map((o) => (
          <DropdownMenuItem key={o.days} onSelect={() => apply(plusDays(o.days))}>
            {o.label}
          </DropdownMenuItem>
        ))}
        {active && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => apply(null)}>Clear snooze</DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
