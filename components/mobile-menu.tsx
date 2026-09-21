"use client";

import Link from "next/link";
import { useTheme } from "next-themes";
import { CalendarRange, Columns3, Download, KeyRound, List, LogOut, Menu, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/** Phone-width replacement for the header icon row: one menu with view, export, theme, account. */
export function MobileMenu() {
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Menu" className="sm:hidden">
          <Menu className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel>View</DropdownMenuLabel>
        <DropdownMenuItem asChild>
          <Link href="/">
            <List aria-hidden />
            List
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/board">
            <Columns3 aria-hidden />
            Board
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/digest">
            <CalendarRange aria-hidden />
            Digest
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Export</DropdownMenuLabel>
        <DropdownMenuItem asChild>
          <a href="/api/export?format=json" download>
            <Download aria-hidden />
            JSON (backup)
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href="/api/export?format=md" download>
            <Download aria-hidden />
            Markdown
          </a>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}>
          <Sun className="hidden dark:block" aria-hidden />
          <Moon className="dark:hidden" aria-hidden />
          Toggle theme
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/account/password">
            <KeyRound aria-hidden />
            Change password
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <form action="/auth/signout" method="post" className="contents">
            <button type="submit" className="flex w-full items-center gap-2">
              <LogOut aria-hidden />
              Sign out
            </button>
          </form>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
