import { requireUser } from "@/lib/auth";
import { listInitiativeOptions } from "@/lib/queries";
import { classifyDbError, rootCause } from "@/lib/db-error";
import { AppHeader } from "@/components/app-shell";
import { QuickCapture } from "@/components/quick-capture";
import { DatabaseProblem } from "@/components/database-problem";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  await requireUser();

  // The first query of every page. If it fails, explain why instead of a bare 500.
  let options: Awaited<ReturnType<typeof listInitiativeOptions>>;
  try {
    options = await listInitiativeOptions();
  } catch (err) {
    const cause = rootCause(err);
    console.error("[workhub] database error:", cause.code ?? "", cause.message ?? String(err));
    return (
      <>
        <AppHeader />
        <DatabaseProblem problem={classifyDbError(err)} />
      </>
    );
  }

  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">{children}</main>
      <QuickCapture initiatives={options} />
    </>
  );
}
