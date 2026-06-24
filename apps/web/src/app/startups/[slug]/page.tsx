import { notFound } from "next/navigation";
import AppHeader from "@/app/_components/layout/app-header";
import StartupPageClient from "@/app/startups/startup-page-client";
import { fetchStartup } from "@/lib/api/client";

interface Props {
  params: Promise<{ slug: string }>;
}

// Public canonical route for verified startups, addressed by their verified
// domain (e.g. /startups/acme.com). The slug IS the domain — no transform.
export default async function StartupSlugPage({ params }: Props) {
  const { slug } = await params;

  // The backend resolves a non-UUID identifier against verified startups only,
  // so an unknown or non-verified domain returns null here.
  const startup = await fetchStartup(slug.toLowerCase());

  if (!startup) notFound();

  return (
    <div className="flex h-screen flex-col bg-bg">
      <AppHeader customTab={{ label: startup.name }} />

      <main className="flex-1 overflow-y-auto overflow-x-hidden">
        <StartupPageClient startup={startup} />
      </main>
    </div>
  );
}
