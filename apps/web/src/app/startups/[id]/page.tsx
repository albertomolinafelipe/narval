import { notFound } from "next/navigation";
import AppHeader from "@/app/_components/layout/app-header";
import StartupPageClient from "./startup-page-client";
import { fetchStartup } from "@/lib/api/client";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function StartupDetailPage({ params }: Props) {
  const { id } = await params;

  // Prefetch the startup on the server for initial render
  // SuperTokens session is cookie-based (credentials: "include" is already set in fetchStartup)
  const startup = await fetchStartup(id);

  if (!startup) notFound();

  return (
    <div className="flex h-screen flex-col bg-bg">
      <AppHeader customTab={{ label: startup.name }} />

      <main className="flex-1 overflow-y-auto">
        <StartupPageClient startup={startup} />
      </main>
    </div>
  );
}
