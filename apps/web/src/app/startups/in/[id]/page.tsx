import { notFound, redirect } from "next/navigation";
import AppHeader from "@/app/_components/layout/app-header";
import StartupPageClient from "@/app/startups/startup-page-client";
import { getStartupById } from "@/lib/api/startups";

interface Props {
  params: Promise<{ id: string }>;
}

// Internal canonical route, addressed by UUID. Verified startups have a prettier
// public URL at /startups/<domain>, so we redirect up to it; non-verified ones
// live here permanently.
export default async function StartupDetailPage({ params }: Props) {
  const { id } = await params;

  // Prefetch the startup on the server for initial render. Runs unauthenticated
  // server-side; the client detail hook refetches with the user's session.
  const startup = await getStartupById(id);

  if (!startup) notFound();

  if (startup.verified && startup.verified_domain) {
    redirect(`/startups/${startup.verified_domain}`);
  }

  return (
    <div className="flex h-screen flex-col bg-bg">
      <AppHeader customTab={{ label: startup.name }} />

      <main className="flex-1 overflow-y-auto overflow-x-hidden">
        <StartupPageClient startup={startup} />
      </main>
    </div>
  );
}
