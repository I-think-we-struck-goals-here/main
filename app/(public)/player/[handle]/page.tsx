import Link from "next/link";
import { notFound } from "next/navigation";

import { buildMonzoLink, formatSignedGbp } from "@/lib/money";
import {
  getActiveSeason,
  getPlayerAllTimeStats,
  getPlayerSeasonStats,
} from "@/lib/stats";

export const dynamic = "force-dynamic";

type PlayerPageProps = {
  params: { handle: string };
};

const formatRate = (value: number) => value.toFixed(1);
const formatPct = (value: number) => `${Math.round(value * 100)}%`;
const formatSigned = (value: number) => `${value >= 0 ? "+" : ""}${value.toFixed(1)}`;

export default async function PlayerPage({ params }: PlayerPageProps) {
  const activeSeason = await getActiveSeason();
  const [seasonStats, allTimeStats] = await Promise.all([
    activeSeason
      ? getPlayerSeasonStats(params.handle, activeSeason.id)
      : Promise.resolve(null),
    getPlayerAllTimeStats(params.handle),
  ]);

  if (!allTimeStats) {
    notFound();
  }

  const currentOwedPence = seasonStats?.owedPence ?? 0;
  const showPayButton = currentOwedPence > 0;
  const showCredit = currentOwedPence < 0;

  return (
    <div className="flex flex-col gap-8">
      <section className="rounded-[32px] border border-black/10 bg-white/90 p-8 shadow-sm">
        <p className="text-xs uppercase tracking-[0.3em] text-black/40">
          Player profile
        </p>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-6">
          <div>
            <h1 className="text-3xl font-semibold text-black">
              {allTimeStats.player.displayName}
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-black/60">
              Goals, assists, per-game output, and team record when this player is marked as played.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs uppercase tracking-[0.2em]">
            {activeSeason ? (
              <Link
                href={`/players?season=${activeSeason.slug}`}
                className="rounded-full border border-black/10 bg-white px-4 py-2 text-black/60 hover:text-black"
              >
                {activeSeason.name}
              </Link>
            ) : null}
            <Link
              href="/players?season=all"
              className="rounded-full border border-black/10 bg-white px-4 py-2 text-black/60 hover:text-black"
            >
              All-time
            </Link>
          </div>
        </div>

        <div className="mt-6 grid gap-6 md:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-3xl border border-black/10 bg-black/5 p-6">
            <p className="text-xs uppercase tracking-[0.3em] text-black/40">
              Current owed
            </p>
            <p className="mt-3 text-4xl font-semibold text-black">
              {formatSignedGbp(currentOwedPence)}
            </p>
            {showPayButton ? (
              <a
                href={buildMonzoLink(currentOwedPence)}
                className="mt-4 inline-flex rounded-full bg-black px-5 py-2 text-xs uppercase tracking-[0.2em] text-white"
                target="_blank"
                rel="noopener noreferrer"
              >
                Settle up
              </a>
            ) : showCredit ? (
              <span className="mt-4 inline-flex rounded-full border border-black/10 px-4 py-2 text-xs uppercase tracking-[0.2em] text-black/60">
                Credit balance
              </span>
            ) : (
              <span className="mt-4 inline-flex rounded-full border border-black/10 px-4 py-2 text-xs uppercase tracking-[0.2em] text-black/60">
                All square
              </span>
            )}
          </div>
          <div className="rounded-3xl border border-black/10 bg-white/70 p-6 text-sm text-black/60">
            <p>
              Season stats use <span className="font-semibold text-black">{activeSeason?.name ?? "the current season"}</span>.
            </p>
            <p className="mt-2">
              Team stats only count matches where this player was marked as having played.
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs uppercase tracking-[0.2em] text-black/60">
              <Link href="/players" className="hover:text-black">
                View players tab
              </Link>
              <span>·</span>
              <Link href="/all-time" className="hover:text-black">
                View all-time leaderboard
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <StatsPanel
          title={activeSeason?.name ?? "Season stats"}
          subtitle="Current season"
          stats={seasonStats?.stats ?? allTimeStats.stats}
        />
        <StatsPanel
          title="All-time"
          subtitle="Across every logged season"
          stats={allTimeStats.stats}
        />
      </section>
    </div>
  );
}

function StatsPanel({
  title,
  subtitle,
  stats,
}: {
  title: string;
  subtitle: string;
  stats: Awaited<ReturnType<typeof getPlayerAllTimeStats>> extends { stats: infer T }
    ? T
    : never;
}) {
  return (
    <div className="rounded-[28px] border border-black/10 bg-white/80 p-6 shadow-sm">
      <p className="text-xs uppercase tracking-[0.3em] text-black/40">{subtitle}</p>
      <h2 className="mt-2 text-2xl font-semibold text-black">{title}</h2>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricTile label="Appearances" value={stats.gamesPlayed} />
        <MetricTile label="Goals" value={stats.goals} />
        <MetricTile label="Assists" value={stats.assists} />
        <MetricTile label="G+A / game" value={formatRate(stats.goalContributionsPerGame)} />
        <MetricTile label="GF / game" value={formatRate(stats.goalsForPerGame)} />
        <MetricTile label="GA / game" value={formatRate(stats.goalsAgainstPerGame)} />
        <MetricTile label="Win rate" value={formatPct(stats.winRate)} />
        <MetricTile label="Clean sheets" value={`${stats.cleanSheets}`} />
      </div>

      <div className="mt-5 flex flex-wrap gap-2 text-xs text-black/55">
        <MetaPill label="Record" value={`${stats.wins}-${stats.draws}-${stats.losses}`} />
        <MetaPill label="Points / game" value={formatRate(stats.pointsPerGame)} />
        <MetaPill label="Goal involvement" value={formatPct(stats.contributionRate)} />
        <MetaPill label="Goal diff / game" value={formatSigned(stats.goalDifferencePerGame)} />
        <MetaPill label="GF while playing" value={`${stats.teamGoalsFor}`} />
        <MetaPill label="GA while playing" value={`${stats.teamGoalsAgainst}`} />
      </div>
    </div>
  );
}

function MetricTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-black/8 bg-black/[0.03] px-4 py-3">
      <p className="text-[10px] uppercase tracking-[0.2em] text-black/35">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-black">{value}</p>
    </div>
  );
}

function MetaPill({ label, value }: { label: string; value: string }) {
  return (
    <span className="rounded-full border border-black/10 bg-white px-3 py-1.5">
      <span className="text-black/35">{label}</span> · <span className="text-black/70">{value}</span>
    </span>
  );
}
