"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const configIssue = /DATABASE_URL|SUPABASE/.test(error.message);
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-16">
      <EmptyState
        icon={AlertTriangle}
        title={configIssue ? "WorkHub isn't configured yet" : "Something went wrong"}
        description={
          configIssue
            ? error.message
            : "The request failed. Try again; if it keeps happening, check the server logs."
        }
        action={
          <Button onClick={reset} variant="outline">
            Try again
          </Button>
        }
      />
    </main>
  );
}
