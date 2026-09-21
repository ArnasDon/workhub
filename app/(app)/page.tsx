import Link from "next/link";
import { FolderKanban, Plus, SearchX } from "lucide-react";
import { STATUSES, STATUS_LABEL, GROUPINGS, SORTS, type Grouping, type Sort } from "@/lib/constants";
import { listAreas, listInitiatives, search, type InitiativeWithActivity } from "@/lib/queries";
import { relativeDays } from "@/lib/format";
import { InitiativeCard } from "@/components/initiative-card";
import { DashboardToolbar } from "@/components/dashboard-toolbar";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status-badge";
import { plainText } from "@/lib/plain-text";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

function pick<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

export default async function DashboardPage({ searchParams }: PageProps<"/">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const grouping = pick<Grouping>(sp.group, GROUPINGS, "status");
  const sort = pick<Sort>(sp.sort, SORTS, "activity");
  const area = typeof sp.area === "string" && sp.area ? sp.area : undefined;
  const archived = sp.archived === "1";
  const now = new Date();

  if (q) return <SearchResults q={q} now={now} />;

  const [items, areas] = await Promise.all([listInitiatives({ includeArchived: archived, area, sort }), listAreas()]);

  if (items.length === 0 && !area && !archived) {
    return (
      <EmptyState
        icon={FolderKanban}
        title="Nothing in flight yet"
        description="Add the initiatives you're juggling right now. Each one gets a running log so you never lose the why behind a decision."
        action={
          <Button asChild>
            <Link href="/initiatives/new">
              <Plus data-icon="inline-start" aria-hidden />
              Create your first initiative
            </Link>
          </Button>
        }
      />
    );
  }

  const groups = groupItems(items, grouping);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">In flight</h1>
          <p className="text-sm text-muted-foreground">
            {items.length} {items.length === 1 ? "initiative" : "initiatives"}
            {area && <> in <span className="font-medium text-foreground">{area}</span></>}
          </p>
        </div>
      </div>

      <DashboardToolbar grouping={grouping} sort={sort} area={area} archived={archived} areas={areas} />

      {items.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title="No initiatives match"
          description="Clear the area filter or show archived items to see more."
          action={
            <Button asChild variant="outline">
              <Link href="/">Clear filters</Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-8">
          {groups.map((g) => (
            <section key={g.key} aria-labelledby={`group-${g.key}`}>
              <div className="mb-3 flex items-baseline gap-2">
                <h2 id={`group-${g.key}`} className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  {g.label}
                </h2>
                <span className="text-xs text-muted-foreground/70">{g.items.length}</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {g.items.map((item) => (
                  <InitiativeCard key={item.id} item={item} now={now} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function groupItems(items: InitiativeWithActivity[], grouping: Grouping) {
  if (grouping === "status") {
    return STATUSES.map((s) => ({ key: s, label: STATUS_LABEL[s], items: items.filter((i) => i.status === s) })).filter(
      (g) => g.items.length > 0,
    );
  }
  const map = new Map<string, InitiativeWithActivity[]>();
  for (const i of items) {
    const k = i.area || "No area";
    map.set(k, [...(map.get(k) ?? []), i]);
  }
  return [...map.entries()]
    .sort(([a], [b]) => (a === "No area" ? 1 : b === "No area" ? -1 : a.localeCompare(b)))
    .map(([label, list]) => ({ key: label.toLowerCase().replace(/\W+/g, "-"), label, items: list }));
}

async function SearchResults({ q, now }: { q: string; now: Date }) {
  const res = await search(q);
  const total = res.initiatives.length + res.entries.length;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Results for &ldquo;{q}&rdquo;
        </h1>
        <p className="text-sm text-muted-foreground">
          {total === 0 ? "No matches." : `${res.initiatives.length} initiatives · ${res.entries.length} log entries`}
          {" · "}
          <Link href="/" className="underline underline-offset-4 hover:text-foreground">
            Back to dashboard
          </Link>
        </p>
      </div>

      {total === 0 && (
        <EmptyState
          icon={SearchX}
          title="Nothing found"
          description="Search covers titles, areas, and every log entry. Try a shorter word, quotes for an exact phrase, or -word to exclude."
        />
      )}

      {res.initiatives.length > 0 && (
        <section aria-labelledby="search-initiatives">
          <h2 id="search-initiatives" className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Initiatives
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {res.initiatives.map((item) => (
              <InitiativeCard key={item.id} item={item} now={now} />
            ))}
          </div>
        </section>
      )}

      {res.entries.length > 0 && (
        <section aria-labelledby="search-entries">
          <h2 id="search-entries" className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Log entries
          </h2>
          <ol className="space-y-2">
            {res.entries.map((e) => (
              <li key={e.id} className="rounded-xl border bg-card p-4 shadow-xs">
                <div className="mb-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Link href={`/initiatives/${e.initiativeId}`} className="font-medium text-foreground hover:underline underline-offset-4">
                    {e.initiativeTitle}
                  </Link>
                  <StatusBadge status={e.initiativeStatus} className="h-5 px-1.5 text-[11px]" />
                  <span>{relativeDays(e.createdAt, now)}</span>
                </div>
                <p className="line-clamp-4 break-words text-sm">{plainText(e.body, 600)}</p>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
