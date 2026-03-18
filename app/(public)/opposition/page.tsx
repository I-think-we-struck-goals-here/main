import Link from "next/link";

import {
  buildTeamSeasonSummary,
  formatPlayFootballTeamName,
  getPlayFootballSnapshot,
  getStoredPlayFootballSnapshots,
  normalizePlayFootballTeamName,
  type TeamSeasonSummary,
} from "@/lib/playfootball";
import { getActiveSeason, getSeasons } from "@/lib/stats";

export const dynamic = "force-dynamic";

const FORFEIT_TEAM = "Call Now To Enter 01702 414079";

const outcomeStyles: Record<"W" | "D" | "L", string> = {
  W: "border-emerald-500/30 bg-emerald-500/12 text-emerald-700",
  D: "border-amber-400/30 bg-amber-400/18 text-amber-700",
  L: "border-rose-500/30 bg-rose-500/12 text-rose-700",
};

type SearchParams = {
  team?: string;
  season?: string;
};

type OppositionPageProps = {
  searchParams?: SearchParams | Promise<SearchParams>;
};

const formatPct = (value: number) => `${Math.round(value * 100)}%`;
const formatRate = (value: number) => value.toFixed(1);
const formatSigned = (value: number) => `${value >= 0 ? "+" : ""}${value}`;

const buildSeasonHref = (team: string, seasonSlug: string) =>
  `/opposition?team=${encodeURIComponent(team)}&season=${encodeURIComponent(seasonSlug)}`;

const resolveSnapshotTeamName = (
  team: string,
  snapshot: Awaited<ReturnType<typeof getPlayFootballSnapshot>>
) => {
  if (!snapshot) {
    return formatPlayFootballTeamName(team);
  }

  const target = normalizePlayFootballTeamName(team);
  const candidates = new Map<string, string>();

  for (const row of snapshot.standings) {
    candidates.set(normalizePlayFootballTeamName(row.team), formatPlayFootballTeamName(row.team));
  }

  for (const fixture of snapshot.fixtures) {
    candidates.set(
      normalizePlayFootballTeamName(fixture.home),
      formatPlayFootballTeamName(fixture.home)
    );
    candidates.set(
      normalizePlayFootballTeamName(fixture.away),
      formatPlayFootballTeamName(fixture.away)
    );
  }

  return candidates.get(target) ?? formatPlayFootballTeamName(team);
};

function SummaryCard({
  label,
  value,
  meta,
}: {
  label: string;
  value: string;
  meta: string;
}) {
  return (
    <div className="rounded-[24px] border border-black/10 bg-white/80 p-5 shadow-sm">
      <p className="text-[10px] uppercase tracking-[0.26em] text-black/35">{label}</p>
      <p className="mt-3 text-3xl font-semibold text-black">{value}</p>
      <p className="mt-2 text-sm text-black/55">{meta}</p>
    </div>
  );
}

function DetailPill({ label, value }: { label: string; value: string }) {
  return (
    <span className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs text-black/60">
      <span className="text-black/35">{label}</span> · <span className="text-black/70">{value}</span>
    </span>
  );
}

function buildSummaryMeta(summary: TeamSeasonSummary) {
  return `${summary.wins}-${summary.draws}-${summary.losses} record`;
}

export default async function OppositionPage({ searchParams }: OppositionPageProps) {
  const resolvedSearchParams = await Promise.resolve(searchParams ?? {});
  const [activeSeason, seasons] = await Promise.all([getActiveSeason(), getSeasons()]);

  const selectedSeason =
    seasons.find((season) => season.slug === resolvedSearchParams.season) ??
    activeSeason ??
    seasons[0] ??
    null;

  const rawTeam =
    typeof resolvedSearchParams.team === "string"
      ? resolvedSearchParams.team.trim()
      : "";

  if (!selectedSeason) {
    return (
      <section className="rounded-[32px] border border-black/10 bg-white/90 p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-black">No season selected</h1>
        <p className="mt-2 text-sm text-black/60">
          Create a season first, then sync PlayFootball data to unlock opponent results.
        </p>
      </section>
    );
  }

  if (!rawTeam) {
    return (
      <section className="rounded-[32px] border border-black/10 bg-white/90 p-8 shadow-sm">
        <p className="text-xs uppercase tracking-[0.3em] text-black/40">Opposition</p>
        <h1 className="mt-2 text-2xl font-semibold text-black">Choose a fixture first</h1>
        <p className="mt-2 text-sm text-black/60">
          Open any upcoming fixture on the home page or league page to inspect that team’s season results.
        </p>
      </section>
    );
  }

  const snapshot = await getPlayFootballSnapshot(selectedSeason);

  if (!snapshot) {
    return (
      <section className="rounded-[32px] border border-black/10 bg-white/90 p-8 shadow-sm">
        <p className="text-xs uppercase tracking-[0.3em] text-black/40">Opposition</p>
        <h1 className="mt-2 text-2xl font-semibold text-black">PlayFootball data unavailable</h1>
        <p className="mt-2 text-sm text-black/60">
          No cached fixture/results snapshot is available for {selectedSeason.name} yet.
        </p>
      </section>
    );
  }

  const activeTeams = snapshot.standings.map((row) => formatPlayFootballTeamName(row.team));
  const teamName = resolveSnapshotTeamName(rawTeam, snapshot);
  const storedSnapshots = await getStoredPlayFootballSnapshots(seasons.map((season) => season.id));
  storedSnapshots.set(selectedSeason.id, snapshot);

  const availableSeasons = seasons.filter((season) => {
    const seasonSnapshot = storedSnapshots.get(season.id);
    if (!seasonSnapshot) {
      return false;
    }

    const seasonActiveTeams = seasonSnapshot.standings.map((row) =>
      formatPlayFootballTeamName(row.team)
    );
    const seasonSummary = buildTeamSeasonSummary(seasonSnapshot.fixtures, teamName, {
      activeTeams: seasonActiveTeams,
      forfeitTeam: FORFEIT_TEAM,
      forfeitScore: [8, 0],
    });

    return seasonSummary.results.length > 0;
  });
  const selectedSeasonHasResults = availableSeasons.some(
    (season) => season.id === selectedSeason.id
  );

  const { summary, results } = buildTeamSeasonSummary(snapshot.fixtures, teamName, {
    activeTeams,
    forfeitTeam: FORFEIT_TEAM,
    forfeitScore: [8, 0],
  });

  const standingsRow = snapshot.standings.find(
    (row) => formatPlayFootballTeamName(row.team) === teamName
  );

  return (
    <div className="flex flex-col gap-8">
      <section className="rounded-[32px] border border-black/10 bg-white/90 p-8 shadow-sm">
        <p className="text-xs uppercase tracking-[0.3em] text-black/40">Opposition</p>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-5">
          <div>
            <h1 className="text-3xl font-semibold text-black">{summary.team}</h1>
            <div className="mt-4 flex flex-wrap gap-2">
              <DetailPill label="Win rate" value={formatPct(summary.winRate)} />
              <DetailPill label="Draw rate" value={formatPct(summary.drawRate)} />
              <DetailPill label="Loss rate" value={formatPct(summary.lossRate)} />
              <DetailPill label="Goal diff" value={formatSigned(summary.goalDifference)} />
              <DetailPill
                label="Clean sheets"
                value={`${summary.cleanSheets} (${formatPct(summary.cleanSheetRate)})`}
              />
            </div>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            {!selectedSeasonHasResults ? (
              <p className="rounded-full border border-black/10 bg-black/[0.03] px-4 py-2 text-xs uppercase tracking-[0.2em] text-black/45">
                {selectedSeason.name}
              </p>
            ) : null}
            {availableSeasons.length > 1 ? (
              availableSeasons.map((season) => {
                const isActive = season.id === selectedSeason.id;
                return (
                  <Link
                    key={season.id}
                    href={buildSeasonHref(teamName, season.slug)}
                    className={`rounded-full px-4 py-2 text-xs uppercase tracking-[0.2em] ${
                      isActive
                        ? "bg-black text-white"
                        : "border border-black/10 bg-white text-black/60 hover:text-black"
                    }`}
                  >
                    {season.name}
                  </Link>
                );
              })
            ) : availableSeasons.length === 1 ? (
              availableSeasons[0].id === selectedSeason.id ? (
                <p className="rounded-full border border-black/10 bg-black/[0.03] px-4 py-2 text-xs uppercase tracking-[0.2em] text-black/45">
                  {availableSeasons[0].name}
                </p>
              ) : (
                <Link
                  href={buildSeasonHref(teamName, availableSeasons[0].slug)}
                  className="rounded-full border border-black/10 bg-white px-4 py-2 text-xs uppercase tracking-[0.2em] text-black/60 hover:text-black"
                >
                  {availableSeasons[0].name}
                </Link>
              )
            ) : null}
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Record"
          value={`${summary.wins}-${summary.draws}-${summary.losses}`}
          meta={`${summary.games} games played`}
        />
        <SummaryCard
          label="Goals"
          value={`${summary.goalsFor} / ${summary.goalsAgainst}`}
          meta={`GF ${formatRate(summary.scoredPerGame)} · GA ${formatRate(summary.concededPerGame)}`}
        />
        <SummaryCard
          label="Points"
          value={`${summary.points}`}
          meta={`${formatRate(summary.pointsPerGame)} points per game`}
        />
        <SummaryCard
          label="Form"
          value={summary.form.length ? summary.form.join("") : "—"}
          meta={standingsRow ? `League position ${standingsRow.position}` : buildSummaryMeta(summary)}
        />
      </section>

      <section className="rounded-[32px] border border-black/10 bg-white/85 p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="text-xs uppercase tracking-[0.3em] text-black/40">Results</p>
          <p className="text-xs uppercase tracking-[0.2em] text-black/40">
            {results.length} completed
          </p>
        </div>

        {results.length ? (
          <div className="mt-5 flex flex-col gap-3">
            {results.map((result) => (
              <div
                key={`${result.kickoffAt ?? result.dateLabel}-${result.opponent}-${result.scored}-${result.conceded}`}
                className="rounded-[24px] border border-black/8 bg-black/[0.02] px-5 py-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-[0.24em] text-black/40">
                      {result.dateLabel} · {result.time} · {result.venueLabel}
                    </p>
                    <h3 className="mt-2 truncate text-lg font-semibold text-black">
                      vs {result.opponent}
                    </h3>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] ${outcomeStyles[result.outcome]}`}>
                      {result.outcome}
                    </span>
                    <span className="text-2xl font-semibold text-black">
                      {result.scored} - {result.conceded}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-5 text-sm text-black/60">
            No completed results available for this team in {selectedSeason.name}.
          </p>
        )}
      </section>
    </div>
  );
}
