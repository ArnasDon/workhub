import Link from "next/link";
import { Command as CommandIcon, KeyRound, LogOut, Plus, Search, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ExportMenu } from "@/components/export-menu";
import { ThemeToggle } from "@/components/theme-toggle";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { OpenPaletteButton } from "@/components/quick-capture";

export function AppHeader({ query }: { query?: string }) {
  return (
    <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-3 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="flex size-7 items-center justify-center rounded-lg bg-primary/12 text-primary">
            <Sparkles className="size-4" aria-hidden />
          </span>
          <span className="hidden sm:inline">WorkHub</span>
        </Link>

        <form action="/" className="relative ml-auto flex-1 sm:ml-4 sm:max-w-md" role="search">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            type="search"
            name="q"
            defaultValue={query ?? ""}
            placeholder="Search initiatives and log…"
            aria-label="Search initiatives and log entries"
            className="h-9 bg-card pl-8"
          />
        </form>

        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <OpenPaletteButton />
            </TooltipTrigger>
            <TooltipContent>
              Quick capture <kbd className="ml-1 rounded bg-muted px-1 font-mono text-[10px]">⌘K</kbd>
            </TooltipContent>
          </Tooltip>
          <ExportMenu />
          <ThemeToggle />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button asChild variant="ghost" size="icon-sm">
                <Link href="/account/password" aria-label="Change password">
                  <KeyRound className="size-4" />
                </Link>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Change password</TooltipContent>
          </Tooltip>
          <form action="/auth/signout" method="post">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button type="submit" variant="ghost" size="icon-sm" aria-label="Sign out">
                  <LogOut className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Sign out</TooltipContent>
            </Tooltip>
          </form>
          <Button asChild size="sm" className="ml-1">
            <Link href="/initiatives/new">
              <Plus data-icon="inline-start" aria-hidden />
              <span className="hidden sm:inline">New initiative</span>
              <span className="sm:hidden">New</span>
            </Link>
          </Button>
        </div>
      </div>
    </header>
  );
}

export { CommandIcon };
