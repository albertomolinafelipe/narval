import { notFound } from "next/navigation";
import AppHeader from "@/app/_components/layout/app-header";
import StartupPageClient from "@/app/startups/startup-page-client";
import { fetchStartup } from "@/lib/api/client";

interface Props {
  params: Promise<{ id: string }>;
}

// Owner-only edit view. Always addressed by UUID (unlike the public page, we do
// NOT redirect verified startups to their domain URL — editing is internal).
// Ownership is enforced client-side for the UI and server-side on every write
// (403 for non-owners), so a non-owner landing here just sees the read-only page.
export default async function StartupEditPage({ params }: Props) {
  const { id } = await params;

  const startup = await fetchStartup(id);

  if (!startup) notFound();

  return (
    <div className="flex h-screen flex-col bg-bg">
      <AppHeader customTab={{ label: startup.name }} />

      <main className="flex-1 overflow-y-auto overflow-x-hidden">
        <StartupPageClient startup={startup} editable />
      </main>
    </div>
  );
}
