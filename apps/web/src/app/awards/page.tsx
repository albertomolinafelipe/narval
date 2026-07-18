"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { useMediaQuery } from "@/lib/use-media-query";
import Link from "next/link";
import { useSpring, animated } from "@react-spring/web";
import { Rocket } from "lucide-react";
import AppHeader from "@/app/_components/layout/app-header";
import { Avatar } from "@/app/_components/shared/list-panel";
import { useStartupsQuery } from "@/lib/api/use-startups-query";
import type { Startup } from "@/lib/api/gen";
import { INDUSTRIES } from "@/lib/enums";
import { startupPath } from "@/lib/startup-url";

const ALL_SECTORS = ["All", ...INDUSTRIES];

// Tallest podium bar takes this fraction of the podium area, leaving
// headroom above every bar for the content card (crown, name, boosts).
const MAX_BAR_FRAC = 0.55;
// Floor for shorter bars, as a fraction of the tallest bar.
const MIN_BAR_FRAC = 0.4;

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

function PodiumEntrants({
  startups,
  size,
}: {
  startups: Startup[];
  size: number;
}) {
  const [open, setOpen] = useState(false);

  // 1-2 entrants: avatar with the company name under it. Fixed-width units so
  // spacing is equal; long names truncate with an ellipsis.
  if (startups.length <= 2) {
    return (
      <div className="flex items-start justify-center gap-1.5">
        {startups.map((s) => (
          <Link
            key={s.id}
            href={startupPath(s)}
            className="flex w-16 flex-col items-center gap-1"
          >
            <Avatar entity={s} size={size} />
            <span className="max-w-full truncate text-xs font-medium text-text hover:underline">
              {s.name}
            </span>
          </Link>
        ))}
      </div>
    );
  }

  // 3+ tied: overlapped avatar stack + a button that reveals every name.
  const overlap = Math.round(size * 4 * 0.4);
  return (
    <div className="relative flex flex-col items-center">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full border border-border bg-bg-subtle py-1 pl-1 pr-2.5 transition-colors hover:border-text-muted"
      >
        <div className="flex">
          {startups.slice(0, 3).map((s, i) => (
            <div
              key={s.id}
              className="rounded-full ring-2 ring-bg"
              style={{ marginLeft: i === 0 ? 0 : -overlap }}
            >
              <Avatar entity={s} size={size} circle />
            </div>
          ))}
        </div>
        <span className="text-xs font-medium text-text-muted">
          {startups.length} tied
        </span>
      </button>
      {open && (
        <div className="absolute bottom-full left-1/2 z-20 mb-2 -translate-x-1/2 rounded-md border border-border bg-bg p-2 shadow-lg">
          {startups.map((s) => (
            <Link key={s.id} href={startupPath(s)}>
              <p className="whitespace-nowrap py-0.5 text-xs text-text hover:underline">
                {s.name}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

const POSITION_LABEL: Record<number, string> = { 1: "1st", 2: "2nd", 3: "3rd" };

function AnimatedBar({
  height,
  isFirst,
}: {
  height: number;
  isFirst: boolean;
}) {
  const styles = useSpring({
    from: { height: 0 },
    to: { height },
    config: { tension: 180, friction: 24 },
  });

  return (
    <animated.div
      style={styles}
      className={`relative w-full overflow-hidden rounded-t-xl shadow-sm ${
        isFirst ? "bg-brand/65" : "bg-brand/40"
      }`}
    >
      {isFirst && (
        <Rocket className="absolute left-1/2 top-1/2 h-1/2 w-auto -translate-x-1/2 -translate-y-1/2 -rotate-45 text-brand-fg opacity-10" />
      )}
    </animated.div>
  );
}

function PodiumColumn({
  position,
  boosts,
  barH,
  startups,
  isFirst,
  isMobile,
}: {
  position: 1 | 2 | 3;
  boosts: number;
  barH: number;
  startups: Startup[];
  isFirst: boolean;
  isMobile: boolean;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-end">
      {/* Content card — sits above the bar */}
      <div className="flex flex-col items-center gap-1.5 pb-2">
        {isFirst && <span className="text-3xl leading-none">👑</span>}
        <span className="text-sm font-bold tracking-tight text-text">
          {POSITION_LABEL[position]}
        </span>
        {startups.length > 0 && (
          <PodiumEntrants startups={startups} size={isMobile ? 9 : 12} />
        )}
        <span className="text-xs text-text-muted">{boosts} boosts</span>
      </div>
      <AnimatedBar height={barH} isFirst={isFirst} />
    </div>
  );
}

export default function AwardsPage() {
  const [selectedSector, setSelectedSector] = useState("All");
  const { data: allStartups = [], isLoading } = useStartupsQuery({
    sort: "trending",
    refetchOnMount: "always",
  });

  const podiumContainerRef = useRef<HTMLDivElement>(null);
  const [podiumH, setPodiumH] = useState(0);
  const isMobile = useMediaQuery("(max-width: 767px)");

  useEffect(() => {
    const el = podiumContainerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setPodiumH(el.clientHeight);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const activeSectors = useMemo(() => {
    const industriesWithBoosts = new Set<string>(
      allStartups
        .filter((s) => (s.boost_count ?? 0) > 0 && s.industry)
        .map((s) => s.industry!),
    );
    return ALL_SECTORS.filter(
      (s) => s === "All" || industriesWithBoosts.has(s),
    );
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
    const podiumSet = new Set(
      sortedRanks.flatMap((r) => byRank.get(r)!.map((s) => s.id)),
    );

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

  const maxBoostInList = Math.max(
    ...rankList.map((s) => s.boost_count ?? 0),
    1,
  );

  const firstBoosts = podiumPositions.first[0]?.boost_count ?? 1;
  const secondBoosts = podiumPositions.second[0]?.boost_count ?? 0;
  const thirdBoosts = podiumPositions.third[0]?.boost_count ?? 0;

  const firstBarH = Math.round(podiumH * MAX_BAR_FRAC);
  const minBarH = Math.round(firstBarH * MIN_BAR_FRAC);
  const secondBarH =
    firstBoosts > 0
      ? Math.max(minBarH, Math.round((secondBoosts / firstBoosts) * firstBarH))
      : minBarH;
  const thirdBarH =
    firstBoosts > 0
      ? Math.max(minBarH, Math.round((thirdBoosts / firstBoosts) * firstBarH))
      : minBarH;

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <AppHeader />
      <div className="flex flex-1 overflow-hidden">
        {/* Left column */}
        <div className="flex w-full flex-col border-r border-border md:w-[60%]">
          {/* Top: sector pills + Podium */}
          <div className="flex h-2/3 flex-col border-b border-border">
            {/* Sector pills */}
            <div className="flex flex-wrap gap-2 border-b border-border px-[var(--page-px)] py-3">
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
            <div
              ref={podiumContainerRef}
              className="flex min-h-0 flex-1 items-end gap-3 px-[var(--page-px)] pb-6"
            >
              {isLoading ? (
                <p className="text-sm text-text-muted">Loading...</p>
              ) : podiumPositions.first.length === 0 ? (
                <p className="text-sm text-text-muted">No boosts yet</p>
              ) : (
                <>
                  <PodiumColumn
                    position={2}
                    boosts={secondBoosts}
                    barH={secondBarH}
                    startups={podiumPositions.second}
                    isFirst={false}
                    isMobile={isMobile}
                  />
                  <PodiumColumn
                    position={1}
                    boosts={firstBoosts}
                    barH={firstBarH}
                    startups={podiumPositions.first}
                    isFirst={true}
                    isMobile={isMobile}
                  />
                  <PodiumColumn
                    position={3}
                    boosts={thirdBoosts}
                    barH={thirdBarH}
                    startups={podiumPositions.third}
                    isFirst={false}
                    isMobile={isMobile}
                  />
                </>
              )}
            </div>
          </div>

          {/* Bottom: Rank List (scrollable) */}
          <div className="flex flex-1 flex-col overflow-y-auto px-[var(--page-px)] py-4">
            {isLoading ? (
              <p className="text-sm text-text-muted">Loading...</p>
            ) : rankList.length === 0 ? (
              <p className="text-sm text-text-muted">No startups to rank</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {rankList.map((startup) => {
                  const boosts = startup.boost_count ?? 0;
                  const barPct =
                    boosts > 0 ? (boosts / maxBoostInList) * 100 : 0;
                  const rank = ranks.get(startup.id);
                  return (
                    <li key={startup.id} className="flex items-center gap-3">
                      <span className="w-6 shrink-0 text-right text-xs text-text-muted">
                        {rank ?? "—"}
                      </span>
                      <Link href={startupPath(startup)} className="shrink-0">
                        <Avatar entity={startup} size={8} />
                      </Link>
                      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="truncate text-sm font-medium text-text">
                          {startup.name}
                        </span>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-bg-subtle">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${barPct}%`,
                              background:
                                "linear-gradient(to right, var(--color-bg-subtle), var(--color-text-muted))",
                            }}
                          />
                        </div>
                      </div>
                      <span className="flex shrink-0 items-center gap-1 text-xs text-text-muted">
                        <Rocket size={12} />
                        {boosts}
                      </span>
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
