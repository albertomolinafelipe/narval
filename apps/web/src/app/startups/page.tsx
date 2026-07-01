import AppHeader from "@/app/_components/layout/app-header";
import StartupsClient from "./startups-client";

interface SearchParams {
  favorited?: string;
  view?: string;
}

export default async function StartupsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  // SuperTokens session is cookie-based, favorited state is handled client-side
  const favoritedOnly = params.favorited === "true";
  const initialView = params.view === "map" ? "map" : "list";

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <AppHeader />
      <div className="flex-1 overflow-hidden px-[var(--page-px)] py-4">
        <StartupsClient
          showFavoritedOnly={favoritedOnly}
          initialView={initialView}
        />
      </div>
    </div>
  );
}
