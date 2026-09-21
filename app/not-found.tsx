import Link from "next/link";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";

export default function NotFound() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-16">
      <EmptyState
        icon={Compass}
        title="That page doesn't exist"
        description="The initiative may have been deleted, or the link is off by a character."
        action={
          <Button asChild>
            <Link href="/">Back to dashboard</Link>
          </Button>
        }
      />
    </main>
  );
}
