import { requireUser } from "@/lib/auth";
import { listInitiativeOptions } from "@/lib/queries";
import { AppHeader } from "@/components/app-shell";
import { QuickCapture } from "@/components/quick-capture";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  await requireUser();
  const options = await listInitiativeOptions();
  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">{children}</main>
      <QuickCapture initiatives={options} />
    </>
  );
}
