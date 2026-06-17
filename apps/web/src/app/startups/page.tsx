import AppHeader from "@/app/_components/layout/app-header";
import StartupsClient from "./startups-client";

interface SearchParams {
  favorited?: string;
}

export default async function StartupsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  // SuperTokens session is cookie-based, favorited state is handled client-side
  const favoritedOnly = params.favorited === "true";

  return (
    <div className="flex h-screen flex-col">
      <AppHeader />
      <div className="flex-1 overflow-hidden px-6 py-4">
        <StartupsClient showFavoritedOnly={favoritedOnly} />
      </div>
    </div>
  );
}
