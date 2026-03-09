import Link from "next/link";

import { getPlayerAnalyticsRows, getSeasons } from "@/lib/stats";

export const dynamic = "force-dynamic";

type SearchParams = {
  season?: string;
};

type PlayersPageProps = {
  searchParams?: SearchParams | Promise<SearchParams>;
};

const formatRate = (value: number) => value.toFixed(1);
const formatPct = (value: number) => `${Math.round(value * 100)}%`;
const formatSigned = (value: number) => `${value >= 0 ? "+" : ""}${value.toFixed(1)}`;

const comparePlayers = (
  a: Awaited<ReturnType<typeof getPlayerAnalyticsRows>>[number],
  b: Awaited<ReturnType<typeof getPlayerAnalyticsRows>>[number]
) =>
  b.goalContributions - a.goalContributions ||
  b.goals - a.goals ||
  b.assists - a.assists ||
  b.gamesPlayed - a.gamesPlayed ||
  a.displayName.localeCompare(b.displayName);

const buildScopeHref = (seasonSlug: string) =>
  seasonSlug === "all" ? "/players?season=all" : `/players?season=${seasonSlug}`;

const leaderBy = <T,>(rows: T[], selector: (row: T) => number) =>
  [...rows].sort((a, b) => selector(b) - selector(a))[0] ?? null;

export default async function PlayersPage({ searchParams }: PlayersPageProps) {
  const resolvedSearchParams = await Promise.resolve(searchParams ?? {});
  const seasons = await getSeasons();
  const activeSeason = seasons.find((season) => season.isActive) ?? seasons[0] ?? null;

  const requestedSeason =
    typeof resolvedSearchParams.season === "string"
      ? resolvedSearchParams.season
      : undefined;

  const selectedSeason =
    requestedSeason && requestedSeason !== "all"
      ? seasons.find((season) => season.slug === requestedSeason) ?? activeSeason
      : requestedSeason === "all"
        ? null
        : activeSeason;

  const selectedScopeSlug = selectedSeason?.slug ?? "all";
  const rows = (await getPlayerAnalyticsRows(selectedSeason?.id))
    .filter((row) => row.gamesPlayed > 0)
    .sort(comparePlayers);

  const title = selectedSeason ? selectedSeason.name : "All-time";
  const summaryRows = rows.filter((row) => row.gamesPlayed > 0);
  const rateQualifiedRows = rows.filter((row) => row.gamesPlayed >= 3);

  const topScorer = leaderBy(summaryRows, (row) => row.goals);
  const topCreator = leaderBy(summaryRows, (row) => row.assists);
  const bestRecord = leaderBy(rateQualifiedRows, (row) => row.pointsPerGame);
  const bestDefence = [...rateQualifiedRows].sort(
    (a, b) =>
      a.goalsAgainstPerGame - b.goalsAgainstPerGame ||
      b.gamesPlayed - a.gamesPlayed ||
      a.displayName.localeCompare(b.displayName)
  )[0] ?? null;

  if (rows.length === 0) {
    return (
      <section className="rounded-[32px] border border-black/10 bg-white/80 p-8 shadow-sm">
        <p className="text-xs uppercase tracking-[0.3em] text-black/40">Players</p>
        <h1 className="mt-2 text-2xl font-semibold text-black">No player stats yet</h1>
        <p className="mt-2 text-sm text-black/60">
          Log matches with appearances to unlock player breakdowns.
        </p>
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <section className="rounded-[32px] border border-black/10 bg-white/90 p-8 shadow-sm">
        <p className="text-xs uppercase tracking-[0.3em] text-black/40">Players</p>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold text-black">Player breakdowns</h1>
            <p className="mt-2 max-w-2xl text-sm text-black/60">
              Individual output plus team performance when each player is marked as played.
              Toggle any season or all-time to compare quickly.
            </p>
          </div>
          <div className="rounded-full border border-black/10 bg-black/[0.04] px-4 py-2 text-xs uppercase tracking-[0.24em] text-black/50">
            {title}
          </div>
        </div>
        <div className="mt-6 flex flex-wrap gap-2">
          <Link
            href={buildScopeHref("all")}
            className={`rounded-full px-4 py-2 text-xs uppercase tracking-[0.2em] ${
              selectedScopeSlug === "all"
                ? "bg-black text-white"
                : "border border-black/10 bg-white text-black/60 hover:text-black"
            }`}
          >
            All-time
          </Link>
          {seasons.map((season) => {
            const isActive = selectedScopeSlug === season.slug;
            return (
              <Link
                key={season.id}
                href={buildScopeHref(season.slug)}
                className={`rounded-full px-4 py-2 text-xs uppercase tracking-[0.2em] ${
                  isActive
                    ? "bg-black text-white"
                    : "border border-black/10 bg-white text-black/60 hover:text-black"
                }`}
              >
                {season.name}
              </Link>
            );
          })}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <LeaderCard
          label="Top scorer"
          player={topScorer?.displayName ?? "—"}
          value={topScorer ? `${topScorer.goals} goals` : "—"}
          meta={topScorer ? `${formatRate(topScorer.goalsPerGame)}/game` : "—"}
        />
        <LeaderCard
          label="Top creator"
          player={topCreator?.displayName ?? "—"}
          value={topCreator ? `${topCreator.assists} assists` : "—"}
          meta={topCreator ? `${formatRate(topCreator.assistsPerGame)}/game` : "—"}
        />
        <LeaderCard
          label="Best record"
          player={bestRecord?.displayName ?? "—"}
          value={bestRecord ? `${formatRate(bestRecord.pointsPerGame)} pts/game` : "—"}
          meta={bestRecord ? `${bestRecord.wins}-${bestRecord.draws}-${bestRecord.losses}` : "Min 3 apps"}
        />
        <LeaderCard
          label="Best defence"
          player={bestDefence?.displayName ?? "—"}
          value={bestDefence ? `${formatRate(bestDefence.goalsAgainstPerGame)} GA/game` : "—"}
          meta={bestDefence ? `${bestDefence.cleanSheets} clean sheets` : "Min 3 apps"}
        />
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-black/40">Breakdown</p>
            <h2 className="mt-1 text-2xl font-semibold text-black">Every player</h2>
          </div>
          <p className="text-xs text-black/45">
            Sorted by goal involvements, then goals, then assists.
          </p>
        </div>

        <div className="flex flex-col gap-4">
          {rows.map((row, index) => (
            <Link
              key={row.playerId}
              href={`/player/${row.handle}`}
              className="rounded-[28px] border border-black/10 bg-white/85 p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-black/20 hover:shadow-md"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] uppercase tracking-[0.3em] text-black/35">
                      #{index + 1}
                    </span>
                    {!row.isActive ? (
                      <span className="rounded-full border border-black/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] text-black/50">
                        Inactive
                      </span>
                    ) : null}
                  </div>
                  <h3 className="mt-2 truncate text-xl font-semibold text-black">
                    {row.displayName}
                  </h3>
                  <p className="mt-1 text-sm text-black/55">
                    {row.gamesPlayed} appearances · {row.wins}-{row.draws}-{row.losses} record
                  </p>
                </div>
                <div className="rounded-full border border-black/10 bg-black/[0.03] px-4 py-2 text-right text-xs uppercase tracking-[0.18em] text-black/55">
                  {formatPct(row.winRate)} win rate
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
                <MetricTile label="Goals" value={row.goals} />
                <MetricTile label="Assists" value={row.assists} />
                <MetricTile label="G+A" value={row.goalContributions} />
                <MetricTile
                  label="G+A / game"
                  value={formatRate(row.goalContributionsPerGame)}
                />
                <MetricTile
                  label="GF / game"
                  value={formatRate(row.goalsForPerGame)}
                />
                <MetricTile
                  label="GA / game"
                  value={formatRate(row.goalsAgainstPerGame)}
                />
              </div>

              <div className="mt-4 flex flex-wrap gap-2 text-xs text-black/55">
                <MetaPill label="Points / game" value={formatRate(row.pointsPerGame)} />
                <MetaPill label="Goal involvement" value={formatPct(row.contributionRate)} />
                <MetaPill
                  label="Goal diff / game"
                  value={formatSigned(row.goalDifferencePerGame)}
                />
                <MetaPill
                  label="Clean sheets"
                  value={`${row.cleanSheets} (${formatPct(row.cleanSheetRate)})`}
                />
                <MetaPill
                  label="GF while playing"
                  value={`${row.teamGoalsFor} total`}
                />
                <MetaPill
                  label="GA while playing"
                  value={`${row.teamGoalsAgainst} total`}
                />
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

function LeaderCard({
  label,
  player,
  value,
  meta,
}: {
  label: string;
  player: string;
  value: string;
  meta: string;
}) {
  return (
    <div className="rounded-[24px] border border-black/10 bg-white/85 p-5 shadow-sm">
      <p className="text-xs uppercase tracking-[0.3em] text-black/35">{label}</p>
      <p className="mt-3 text-lg font-semibold text-black">{player}</p>
      <p className="mt-1 text-2xl font-semibold text-black">{value}</p>
      <p className="mt-2 text-sm text-black/50">{meta}</p>
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
