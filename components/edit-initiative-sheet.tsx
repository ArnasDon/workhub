"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import type { Initiative } from "@/db/schema";
import { updateInitiative } from "@/lib/actions";
import { InitiativeForm } from "@/components/initiative-form";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

export function EditInitiativeSheet({ initiative, areas }: { initiative: Initiative; areas: string[] }) {
  const [open, setOpen] = useState(false);
  const action = updateInitiative.bind(null, initiative.id);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <Pencil data-icon="inline-start" aria-hidden />
          Edit
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Edit initiative</SheetTitle>
          <SheetDescription>Status changes made here are recorded in the log.</SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-6">
          <InitiativeForm
            action={action}
            initiative={initiative}
            areas={areas}
            submitLabel="Save changes"
            onSaved={() => {
              setOpen(false);
              toast.success("Saved");
            }}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
