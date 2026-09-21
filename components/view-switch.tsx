"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Columns3, List } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/** List ↔ Board toggle. Carries the ?area= filter across; drops the list-only params. */
export function ViewSwitch() {
  const pathname = usePathname();
  const sp = useSearchParams();
  const area = sp.get("area");
  const qs = area ? `?area=${encodeURIComponent(area)}` : "";
  const items = [
    { href: `/${qs}`, label: "List", icon: List, active: pathname === "/" },
    { href: `/board${qs}`, label: "Board", icon: Columns3, active: pathname === "/board" },
  ];
  return (
    <div role="group" aria-label="View" className="hidden items-center rounded-lg border bg-card p-0.5 sm:inline-flex">
      {items.map(({ href, label, icon: Icon, active }) => (
        <Tooltip key={label}>
          <TooltipTrigger asChild>
            <Link
              href={href}
              aria-label={`${label} view`}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex size-7 items-center justify-center rounded-md transition-colors",
                active ? "bg-secondary text-secondary-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="size-4" aria-hidden />
            </Link>
          </TooltipTrigger>
          <TooltipContent>{label} view</TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}
