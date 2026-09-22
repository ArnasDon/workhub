import { cn } from "@/lib/utils";

/**
 * WorkHub mark: a "W" drawn as a trail of log entries (round nodes joined by a
 * path), with the centre node emphasised as the hub. Fills with `currentColor`
 * so it follows the theme; wrap it in a tile (see `Logo`) for the branded look.
 * The favicon in app/icon.svg is this same geometry on a terracotta tile.
 */
export function LogoMark({ className, ...props }: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="currentColor"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
      {...props}
    >
      <polyline points="12,20 22.5,45 32,25 41.5,45 52,20" fill="none" strokeWidth={5} />
      <circle cx={12} cy={20} r={4.5} stroke="none" />
      <circle cx={22.5} cy={45} r={4.5} stroke="none" />
      <circle cx={32} cy={25} r={7} stroke="none" />
      <circle cx={41.5} cy={45} r={4.5} stroke="none" />
      <circle cx={52} cy={20} r={4.5} stroke="none" />
    </svg>
  );
}

const TILE = {
  sm: "size-7 rounded-lg [&>svg]:size-5",
  md: "size-9 rounded-xl [&>svg]:size-6",
  lg: "size-14 rounded-2xl [&>svg]:size-9",
} as const;

/** The mark on a terracotta tile: the same image as the favicon, in theme tokens. */
export function LogoTile({ size = "sm", className }: { size?: keyof typeof TILE; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center bg-primary text-primary-foreground",
        TILE[size],
        className,
      )}
    >
      <LogoMark />
    </span>
  );
}

/** Tile + wordmark, for headers and the sign-in screen. */
export function Logo({
  size = "sm",
  wordmarkClassName,
  className,
}: {
  size?: keyof typeof TILE;
  wordmarkClassName?: string;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-semibold tracking-tight", className)}>
      <LogoTile size={size} />
      <span className={wordmarkClassName}>WorkHub</span>
    </span>
  );
}
