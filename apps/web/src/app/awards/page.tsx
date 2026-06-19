"use client";


import { useState, useMemo, useRef, useEffect } from "react";
import Link from "next/link";
import { Rocket } from "lucide-react";
import { HiOutlineDotsHorizontal } from "react-icons/hi";
import AppHeader from "@/app/_components/layout/app-header";
import { Avatar } from "@/app/_components/shared/list-panel";
import { useStartupsQuery } from "@/lib/api/use-startups-query";
import { components } from "@/lib/api/generated";

type Startup = components["schemas"]["Startup"];

const ALL_SECTORS = [
  "All",
  "AI/ML",
  "FinTech",
  "HealthTech",
  "Climate Tech",
  "EdTech",
  "SaaS",
  "Marketplace",
  "Developer Tools",
  "Hardware",
  "Consumer",
  "Deep Tech",
  "Logistics",
  "Legal Tech",
  "HR Tech",
  "Other",
];

const LOGO_H = 64;
const CROWN_H = 44;
const GAP = 8;
const LOGO_PADDING_BOTTOM = 12;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function computeCompetitionRank(startups: Startup[]): Map<string, number> {
  const ranks = new Map<string, number>();
  let rank = 1;
  for (let i = 0; i < startups.length; i++) {
    if (i > 0 && startups[i].boost_count !== startups[i - 1].boost_count) {
      rank = i + 1;
    }
    ranks.set(startups[i].id, rank);
  }
  return ranks;
}

function LogoGroup({ startups, size = 16 }: { startups: Startup[]; size?: number }) {
  const [showOverflow, setShowOverflow] = useState(false);
  const visible = startups.slice(0, 3);
  const overflow = startups.slice(3);
  const px = size * 4;

  return (
    <div className="flex flex-wrap items-end justify-center gap-1.5 pb-3">
      {visible.map((s) => (
        <Link key={s.id} href={`/startups/${s.id}`}>
          <Avatar entity={s} size={size} />
        </Link>
      ))}
      {overflow.length > 0 && (
        <div className="relative">
          <button
            onClick={() => setShowOverflow((v) => !v)}
            className="flex items-center justify-center rounded-lg border border-border bg-bg-subtle text-text-muted transition-colors hover:text-text"
            style={{ width: px, height: px }}
          >
            <HiOutlineDotsHorizontal size={20} />
          </button>
          {showOverflow && (
            <div className="absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 rounded border border-border bg-bg p-2 shadow-lg">
              {[...visible, ...overflow].map((s) => (
                <Link key={s.id} href={`/startups/${s.id}`}>
                  <p className="whitespace-nowrap py-0.5 text-xs text-text hover:underline">
                    {s.name}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const POSITION_LABEL: Record<number, string> = { 1: "1st", 2: "2nd", 3: "3rd" };

function PodiumBarContent({
  position,
  boosts,
  isFirst,
  startups,
}: {
  position: 1 | 2 | 3;
  boosts: number;
  isFirst: boolean;
  startups: Startup[];
}) {
  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center gap-1 overflow-hidden px-2">
      {isFirst && (
        <Rocket
          size={180}
          className="absolute text-brand-fg opacity-15"
          style={{ transform: "rotate(-45deg)" }}
        />
      )}
      <span className="relative text-3xl font-black tracking-tight text-text">
        {POSITION_LABEL[position]}
      </span>
      <div className="relative flex flex-col items-center gap-0.5">
        {startups.map((s) => (
          <span key={s.id} className="truncate text-xs font-medium text-text">
            {s.name}
          </span>
        ))}
      </div>
      <span className="relative text-xs text-text-muted">{boosts} boosts</span>
    </div>
  );
}

export default function AwardsPage() {
  const [selectedSector, setSelectedSector] = useState("All");
  const { data: allStartups = [], isLoading } = useStartupsQuery({ sort: "trending" });

  const podiumContainerRef = useRef<HTMLDivElement>(null);
  const [podiumH, setPodiumH] = useState(0);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const el = podiumContainerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setPodiumH(el.clientHeight);
      setIsMobile(window.innerWidth < 768);
    });
    ro.observe(el);
    setIsMobile(window.innerWidth < 768);
    return () => ro.disconnect();
  }, []);

  const activeSectors = useMemo(() => {
    const industriesWithBoosts = new Set(
      allStartups
        .filter((s) => (s.boost_count ?? 0) > 0 && s.industry)
        .map((s) => s.industry!),
    );
    return ALL_SECTORS.filter((s) => s === "All" || industriesWithBoosts.has(s));
  }, [allStartups]);

  const filtered = useMemo(() => {
    if (selectedSector === "All") return allStartups;
    return allStartups.filter((s) => s.industry === selectedSector);
  }, [allStartups, selectedSector]);

  const { podiumPositions, rankList, ranks } = useMemo(() => {
    const withBoosts = [...filtered]
      .filter((s) => (s.boost_count ?? 0) > 0)
      .sort((a, b) => (b.boost_count ?? 0) - (a.boost_count ?? 0));

    const ranks = computeCompetitionRank(withBoosts);

    // Group by rank, take top 3 rank groups (not rank value ≤ 3)
    const byRank = new Map<number, Startup[]>();
    for (const s of withBoosts) {
      const r = ranks.get(s.id)!;
      if (!byRank.has(r)) byRank.set(r, []);
      byRank.get(r)!.push(s);
    }
    for (const [key, arr] of byRank) byRank.set(key, shuffle(arr));

    const sortedRanks = [...byRank.keys()].sort((a, b) => a - b).slice(0, 3);
    const podiumSet = new Set(sortedRanks.flatMap((r) => byRank.get(r)!.map((s) => s.id)));

    const podiumPositions = {
      first: byRank.get(sortedRanks[0]) ?? [],
      second: byRank.get(sortedRanks[1]) ?? [],
      third: byRank.get(sortedRanks[2]) ?? [],
    };

    const rankList = filtered
      .filter((s) => !podiumSet.has(s.id))
      .sort((a, b) => (b.boost_count ?? 0) - (a.boost_count ?? 0));

    return { podiumPositions, rankList, ranks };
  }, [filtered]);

  const maxBoostInList = Math.max(...rankList.map((s) => s.boost_count ?? 0), 1);

  const firstBoosts = podiumPositions.first[0]?.boost_count ?? 1;
  const secondBoosts = podiumPositions.second[0]?.boost_count ?? 0;
  const thirdBoosts = podiumPositions.third[0]?.boost_count ?? 0;

  const firstBarH = Math.max(0, podiumH - CROWN_H - GAP - LOGO_H - LOGO_PADDING_BOTTOM - GAP - 24);
  const minBarH = Math.round(firstBarH * 0.33);
  const secondBarH = firstBoosts > 0 ? Math.max(minBarH, Math.round((secondBoosts / firstBoosts) * firstBarH)) : minBarH;
  const thirdBarH = firstBoosts > 0 ? Math.max(minBarH, Math.round((thirdBoosts / firstBoosts) * firstBarH)) : minBarH;

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <AppHeader />
      <div className="flex flex-1 overflow-hidden">
        {/* Left column */}
        <div className="flex w-full flex-col border-r border-border md:w-[60%]">
          {/* Top: sector pills + Podium */}
          <div className="flex h-2/3 flex-col border-b border-border">
            {/* Sector pills */}
            <div className="flex flex-wrap gap-2 border-b border-border px-6 py-3">
              {activeSectors.map((sector) => (
                <button
                  key={sector}
                  onClick={() => setSelectedSector(sector)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                    selectedSector === sector
                      ? "border-text bg-text text-bg"
                      : "border-border text-text-muted hover:border-text-muted hover:text-text"
                  }`}
                >
                  {sector}
                </button>
              ))}
            </div>

            {/* Podium container */}
            <div ref={podiumContainerRef} className="flex flex-1 items-end gap-3 px-6 pb-6">
              {isLoading ? (
                <p className="text-sm text-text-muted">Loading...</p>
              ) : podiumPositions.first.length === 0 ? (
                <p className="text-sm text-text-muted">No boosts yet</p>
              ) : (
                <>
                  {/* 2nd place */}
                  <div className="flex flex-1 flex-col items-center">
                    {podiumPositions.second.length > 0 && (
                      <LogoGroup startups={podiumPositions.second} size={isMobile ? 10 : 16} />
                    )}
                    <div
                      className="w-full overflow-hidden rounded-t"
                      style={{ height: secondBarH, background: "linear-gradient(to top, var(--color-brand-subtle), color-mix(in srgb, var(--color-brand) 45%, transparent))" }}
                    >
                      <PodiumBarContent position={2} boosts={secondBoosts} isFirst={false} startups={podiumPositions.second} />
                    </div>
                  </div>

                  {/* 1st place */}
                  <div className="flex flex-1 flex-col items-center">
                    <span className="text-4xl">👑</span>
                    <LogoGroup startups={podiumPositions.first} size={isMobile ? 10 : 16} />
                    <div
                      className="w-full overflow-hidden rounded-t"
                      style={{ height: firstBarH, background: "linear-gradient(to top, var(--color-brand-subtle), color-mix(in srgb, var(--color-brand) 45%, transparent))" }}
                    >
                      <PodiumBarContent position={1} boosts={firstBoosts} isFirst={true} startups={podiumPositions.first} />
                    </div>
                  </div>

                  {/* 3rd place */}
                  <div className="flex flex-1 flex-col items-center">
                    {podiumPositions.third.length > 0 && (
                      <LogoGroup startups={podiumPositions.third} size={isMobile ? 10 : 16} />
                    )}
                    <div
                      className="w-full overflow-hidden rounded-t"
                      style={{ height: thirdBarH, background: "linear-gradient(to top, var(--color-brand-subtle), color-mix(in srgb, var(--color-brand) 45%, transparent))" }}
                    >
                      <PodiumBarContent position={3} boosts={thirdBoosts} isFirst={false} startups={podiumPositions.third} />
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Bottom: Rank List (scrollable) */}
          <div className="flex flex-1 flex-col overflow-y-auto px-6 py-4">
            {isLoading ? (
              <p className="text-sm text-text-muted">Loading...</p>
            ) : rankList.length === 0 ? (
              <p className="text-sm text-text-muted">No startups to rank</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {rankList.map((startup) => {
                  const boosts = startup.boost_count ?? 0;
                  const barPct = boosts > 0 ? (boosts / maxBoostInList) * 100 : 0;
                  const rank = ranks.get(startup.id);
                  return (
                    <li key={startup.id} className="flex items-center gap-3">
                      <span className="w-6 shrink-0 text-right text-xs text-text-muted">
                        {rank ?? "—"}
                      </span>
                      <Link href={`/startups/${startup.id}`} className="shrink-0">
                        <Avatar entity={startup} size={8} />
                      </Link>
                      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="truncate text-sm font-medium text-text">
                          {startup.name}
                        </span>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-bg-subtle">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${barPct}%`, background: "linear-gradient(to right, var(--color-bg-subtle), var(--color-text-muted))" }}
                          />
                        </div>
                      </div>
                      <span className="shrink-0 text-xs text-text-muted">{boosts}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        {/* Right column: WIP */}
        <div className="relative hidden w-[40%] flex-col items-center justify-center md:flex">
          <div className="select-none blur-sm">
            <p className="text-2xl font-bold text-text-muted">WIP progress</p>
          </div>
          <span className="wip absolute rounded-md border px-3 py-1.5 text-sm font-medium">
            Coming soon
          </span>
        </div>
      </div>
    </div>
  );
}
