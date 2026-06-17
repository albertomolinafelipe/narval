"use client";

import { useState } from "react";
import * as ScrollArea from "@radix-ui/react-scroll-area";
import PageHeader from "@/app/_components/shared/page-header";
import { components } from "@/lib/api/generated";
import { StartupEditForm } from "./startup-edit-form";

type Startup = components["schemas"]["Startup"];

interface Props {
  startup: Startup;
}

export default function ProfileClient({ startup }: Props) {
  const [currentStartup, setCurrentStartup] = useState<Startup>(startup);

  return (
    <div className="flex h-screen flex-col bg-bg">
      <PageHeader
        breadcrumbs={[
          { label: "Startups", href: "/startups" },
          { label: "Edit profile" },
        ]}
      />

      <ScrollArea.Root className="flex-1 overflow-hidden">
        <ScrollArea.Viewport className="h-full w-full">
          <main className="mx-auto w-full max-w-7xl px-6 py-8">
            <StartupEditForm
              startup={currentStartup}
              onSaved={setCurrentStartup}
            />
          </main>
        </ScrollArea.Viewport>
        <ScrollArea.Scrollbar
          className="flex touch-none select-none bg-transparent transition-colors duration-150 ease-out hover:bg-bg-subtle data-[orientation=vertical]:w-2.5 data-[orientation=horizontal]:h-2.5 data-[orientation=horizontal]:flex-col"
          orientation="vertical"
        >
          <ScrollArea.Thumb className="relative flex-1 rounded-full bg-border hover:bg-text-subtle transition-colors" />
        </ScrollArea.Scrollbar>
        <ScrollArea.Corner className="bg-bg" />
      </ScrollArea.Root>
    </div>
  );
}
