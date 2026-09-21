import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { STATUS_LABEL, STATUS_STYLE, type Status } from "@/lib/constants";

export function StatusBadge({ status, className }: { status: Status; className?: string }) {
  return (
    <Badge variant="outline" className={cn("gap-1.5 font-medium", STATUS_STYLE[status].badge, className)}>
      <span className={cn("size-1.5 rounded-full", STATUS_STYLE[status].dot)} aria-hidden />
      {STATUS_LABEL[status]}
    </Badge>
  );
}
