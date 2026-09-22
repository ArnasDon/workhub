import { cn } from "@/lib/utils";
import { ENTRY_KIND_LABEL, ENTRY_KIND_STYLE, type EntryKind } from "@/lib/constants";
import { Badge } from "@/components/ui/badge";

/** Small label for non-default entry kinds. Renders nothing for plain updates. */
export function EntryKindBadge({ kind, className }: { kind: EntryKind; className?: string }) {
  if (kind === "update") return null;
  return (
    <Badge variant="outline" className={cn("h-5 px-1.5 text-[11px] font-medium", ENTRY_KIND_STYLE[kind], className)}>
      {ENTRY_KIND_LABEL[kind]}
    </Badge>
  );
}
