import Link from "next/link";

import LeaderboardPanel from "@/components/LeaderboardPanel";
import {
  formatPlayFootballTeamName,
  getLatestCompletedRoundFixtures,
  getPlayFootballSnapshot,
  isPlayFootballTeam,
} from "@/lib/playfootball";
import { getActiveSeason, getSeasonLeaderboard, getSeasons } from "@/lib/stats";

export const dynamic = "force-dynamic";

type LeaguePageProps = {
  searchParams?: { season?: string };
};

export default async function LeaguePage({ searchParams }: LeaguePageProps) {
  const [activeSeason, seasonRows] = await Promise.all([
    getActiveSeason(),
    getSeasons(),
  ]);

  const selectedSeason =
    seasonRows.find((season) => season.slug === searchParams?.season) ??
    activeSeason ??
    seasonRows[0] ??
    null;

  if (!selectedSeason) {
    return (
      <section className="rounded-[32px] border border-black/10 bg-white/90 p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">League data unavailable</h1>
        <p className="mt-2 text-sm text-black/60">
          Create a season first, then enable PlayFootball syncing.
        </p>
      </section>
    );
  }

  const [snapshot, leaderboard] = await Promise.all([
    getPlayFootballSnapshot(selectedSeason),
    getSeasonLeaderboard(selectedSeason.id),
  ]);

  const standings = snapshot?.standings ?? [];
  const activeTeams = standings.map((row) => formatPlayFootballTeamName(row.team));
  const latestResults = getLatestCompletedRoundFixtures(snapshot?.fixtures ?? [], {
    activeTeams,
    forfeitTeam: "Call Now To Enter 01702 414079",
    forfeitScore: [8, 0],
  });
  const latestRoundLabel = latestResults[0]?.dateLabel ?? null;
  const lastUpdated = snapshot?.fetchedAt
    ? new Date(snapshot.fetchedAt).toLocaleString("en-GB")
    : null;
  const showSeasonSelector = seasonRows.length > 1;

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-[32px] border border-black/10 bg-white/90 p-8 shadow-sm">
        <p className="text-xs uppercase tracking-[0.3em] text-black/40">
          League
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-black">
          {selectedSeason.name}
        </h1>
        <p className="mt-2 text-sm text-black/60">
          {lastUpdated ? `Last updated: ${lastUpdated}` : "No cached snapshot yet."}
        </p>
        {showSeasonSelector ? (
          <form
            action="/league"
            method="get"
            className="mt-4 flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.2em] text-black/50"
          >
            <label className="flex items-center gap-2">
              Season
              <select
                name="season"
                defaultValue={selectedSeason.slug}
                className="rounded-full border border-black/10 bg-white px-3 py-2 text-xs uppercase tracking-[0.2em] text-black/70"
              >
                {seasonRows.map((season) => (
                  <option key={season.id} value={season.slug}>
                    {season.name}
                  </option>
                ))}
              </select>
            </label>
            <button className="rounded-full border border-black/10 px-4 py-2 text-xs uppercase tracking-[0.2em] text-black/70 hover:border-black/30">
              View
            </button>
          </form>
        ) : null}
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <div className="rounded-[28px] border border-black/10 bg-white/80 p-6 shadow-sm">
          <p className="text-xs uppercase tracking-[0.3em] text-black/40">
            Standings
          </p>
          {standings.length ? (
            <div className="mt-4 grid gap-2 text-xs">
              <div className="grid grid-cols-[24px_1fr_32px_32px_32px_40px] items-center text-[10px] uppercase tracking-[0.2em] text-black/50">
                <span>#</span>
                <span>Team</span>
                <span className="text-right">P</span>
                <span className="text-right">GD</span>
                <span className="text-right">GF</span>
                <span className="text-right">Pts</span>
              </div>
              {standings.map((row) => {
                const isTeam = isPlayFootballTeam(row.team, selectedSeason);
                const teamName = formatPlayFootballTeamName(row.team);
                return (
                  <Link
                    key={row.team}
                    href={{
                      pathname: "/opposition",
                      query: {
                        team: teamName,
                        season: selectedSeason.slug,
                      },
                    }}
                    className={`grid grid-cols-[24px_1fr_32px_32px_32px_40px] items-center rounded-xl px-2 py-2 ${
                      isTeam
                        ? "bg-lime-200/70 text-black hover:bg-lime-200/85"
                        : "text-black/70 hover:bg-black/[0.03] hover:text-black"
                    }`}
                  >
                    <span className="text-[11px] font-semibold">
                      {row.position}
                    </span>
                    <span className="text-xs font-semibold">
                      {teamName}
                    </span>
                    <span className="text-right text-xs">{row.played}</span>
                    <span className="text-right text-xs">{row.goalDiff}</span>
                    <span className="text-right text-xs">{row.goalsFor}</span>
                    <span className="text-right text-xs font-semibold">
                      {row.points}
                    </span>
                  </Link>
                );
              })}
            </div>
          ) : (
            <p className="mt-4 text-sm text-black/60">
              No cached standings yet for this season.
            </p>
          )}
        </div>
        <div className="rounded-[28px] border border-black/10 bg-white/80 p-6 shadow-sm">
          <p className="text-xs uppercase tracking-[0.3em] text-black/40">
            Latest results
          </p>
          {latestResults.length ? (
            <div className="mt-4 flex flex-col gap-3 text-sm text-black/70">
              {latestRoundLabel ? (
                <p className="text-[11px] uppercase tracking-[0.22em] text-black/45">
                  {latestRoundLabel}
                </p>
              ) : null}
              {latestResults.map((fixture) => {
                const homeName = formatPlayFootballTeamName(fixture.home);
                const awayName = formatPlayFootballTeamName(fixture.away);
                const homeTeam = isPlayFootballTeam(homeName, selectedSeason);
                const awayTeam = isPlayFootballTeam(awayName, selectedSeason);
                return (
                  <div
                    key={`${fixture.dateLabel}-${fixture.time}-${fixture.home}-${fixture.away}`}
                    className="rounded-2xl border border-black/5 bg-black/[0.02] p-3"
                  >
                    <p className="text-[11px] uppercase tracking-[0.22em] text-black/45">
                      {fixture.time}
                    </p>
                    <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                      <div className={`min-w-0 text-right text-sm font-semibold ${homeTeam ? "text-black" : "text-black/70"}`}>
                        <span className={homeTeam ? "rounded-full bg-lime-200/70 px-2 py-1" : ""}>
                          {homeName}
                        </span>
                      </div>
                      <div className="rounded-full border border-black/10 bg-white px-3 py-1 text-sm font-semibold text-black">
                        {fixture.scoreHome} - {fixture.scoreAway}
                      </div>
                      <div className={`min-w-0 text-sm font-semibold ${awayTeam ? "text-black" : "text-black/70"}`}>
                        <span className={awayTeam ? "rounded-full bg-lime-200/70 px-2 py-1" : ""}>
                          {awayName}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="mt-4 text-sm text-black/60">
              No completed matchweek results yet.
            </p>
          )}
          <p className="mt-4 text-xs text-black/50">
            Data from PlayFootball (cached).
          </p>
        </div>
      </section>

      <section className="rounded-[32px] border border-black/10 bg-white/90 p-6 shadow-sm">
        <p className="text-xs uppercase tracking-[0.3em] text-black/40">
          Season stats
        </p>
        <h2 className="mt-2 text-xl font-semibold text-black">
          Goals, assists, games played
        </h2>
        <p className="mt-2 text-sm text-black/60">
          Sorted by the stat tabs below.
        </p>
      </section>

      <LeaderboardPanel
        rows={leaderboard}
        tabs={["goals", "assists", "games"]}
        defaultMetric="goals"
      />
    </div>
  );
}
