import AppHeader from "@/app/_components/layout/app-header";

export default function InvestorsPage() {
  return (
    <div className="flex h-screen flex-col">
      <AppHeader />
      <main className="flex flex-1 flex-col items-center justify-center gap-3 text-center px-6">
        <h1 className="text-2xl font-semibold text-text">Investors</h1>
        <p className="text-text-muted max-w-sm">
          Investor profiles are coming soon. Stay tuned.
        </p>
      </main>
    </div>
  );
}
