import Link from "next/link";

import { formatSignedGbp } from "@/lib/money";
import {
  filterFixturesForTeam,
  formatPlayFootballTeamName,
  getTeamAverages,
  getFixtureOpponent,
  getPlayFootballSnapshot,
  isPlayFootballTeam,
  normalizePlayFootballTeamName,
  buildTeamResults,
} from "@/lib/playfootball";
import { getActiveSeason, getSeasonLeaderboard } from "@/lib/stats";

export const dynamic = "force-dynamic";

const FORFEIT_TEAM = "Call Now To Enter 01702 414079";

const outcomeStyles: Record<"W" | "D" | "L", string> = {
  W: "bg-emerald-500/15 text-emerald-700 border-emerald-500/40",
  D: "bg-amber-400/20 text-amber-700 border-amber-400/40",
  L: "bg-rose-500/15 text-rose-700 border-rose-500/40",
};

export default async function HomePage() {
  const activeSeason = await getActiveSeason();

  if (!activeSeason) {
    return (
      <section className="rounded-[32px] border border-black/10 bg-white/80 p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">No season yet</h1>
        <p className="mt-2 text-sm text-black/60">
          Create a season in the admin area to start tracking stats.
        </p>
        <Link
          href="/admin/seasons"
          className="mt-6 inline-flex rounded-full bg-black px-4 py-2 text-xs uppercase tracking-[0.2em] text-white"
        >
          Create season
        </Link>
      </section>
    );
  }

  const [leaderboard, playFootball] = await Promise.all([
    getSeasonLeaderboard(activeSeason.id),
    getPlayFootballSnapshot(activeSeason),
  ]);

  const topScorers = [...leaderboard]
    .sort((a, b) => b.goals - a.goals)
    .slice(0, 3);
  const topAssisters = [...leaderboard]
    .sort((a, b) => b.assists - a.assists)
    .slice(0, 3);
  const mostOwed = [...leaderboard]
    .sort((a, b) => b.owedPence - a.owedPence)
    .slice(0, 3);

  const standings = playFootball?.standings ?? [];
  const fixtures = filterFixturesForTeam(
    playFootball?.fixtures ?? [],
    activeSeason
  );
  const activeTeams = standings.map((row) =>
    formatPlayFootballTeamName(row.team)
  );
  const resultsByTeam = buildTeamResults(playFootball?.fixtures ?? [], {
    activeTeams,
    forfeitTeam: FORFEIT_TEAM,
    forfeitScore: [8, 0],
  });
  const hasPlayFootball = Boolean(playFootball);
  const lastUpdated = playFootball?.fetchedAt
    ? new Date(playFootball.fetchedAt).toLocaleString("en-GB", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  const now = Date.now();
  const upcomingFixtures = fixtures
    .filter((fixture) => {
      if (!fixture.kickoffAt) {
        return true;
      }
      return Date.parse(fixture.kickoffAt) >= now;
    })
    .slice(0, 5);

  return (
    <div className="flex flex-col gap-8">
      <section className="grid gap-6 md:grid-cols-2">
        <div className="rounded-[28px] border border-black/10 bg-white/80 p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <p className="text-xs uppercase tracking-[0.3em] text-black/40">
              League table
            </p>
            {lastUpdated ? (
              <span className="text-[10px] uppercase tracking-[0.2em] text-black/40">
                Updated {lastUpdated}
              </span>
            ) : null}
          </div>
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
                const isTeam = isPlayFootballTeam(row.team, activeSeason);
                return (
                  <div
                    key={row.team}
                    className={`grid grid-cols-[24px_1fr_32px_32px_32px_40px] items-center rounded-xl px-2 py-2 ${
                      isTeam
                        ? "bg-lime-200/70 text-black"
                        : "text-black/70"
                    }`}
                  >
                    <span className="text-[11px] font-semibold">
                      {row.position}
                    </span>
                    <span className="text-xs font-semibold">
                      {formatPlayFootballTeamName(row.team)}
                    </span>
                    <span className="text-right text-xs">{row.played}</span>
                    <span className="text-right text-xs">{row.goalDiff}</span>
                    <span className="text-right text-xs">{row.goalsFor}</span>
                    <span className="text-right text-xs font-semibold">
                      {row.points}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="mt-4 text-sm text-black/60">
              Add PlayFootball URLs to start syncing standings.
            </p>
          )}
        </div>
        <div className="rounded-[28px] border border-black/10 bg-white/80 p-6 shadow-sm">
          <p className="text-xs uppercase tracking-[0.3em] text-black/40">
            Fixtures
          </p>
          {upcomingFixtures.length ? (
            <div className="mt-4 flex flex-col gap-3 text-sm text-black/70">
              {upcomingFixtures.map((fixture) => {
                const { opponent } = getFixtureOpponent(fixture, activeSeason);
                const opponentName = formatPlayFootballTeamName(opponent);
                const opponentNorm = normalizePlayFootballTeamName(opponentName);
                const form = resultsByTeam.get(opponentNorm) ?? [];
                const averages = getTeamAverages(form);
                return (
                  <div
                    key={`${fixture.dateLabel}-${fixture.time}-${fixture.home}-${fixture.away}`}
                    className="rounded-2xl border border-black/5 bg-black/[0.02] p-3"
                  >
                    <p className="text-xs uppercase tracking-[0.2em] text-black/50">
                      {fixture.dateLabel} · {fixture.time}
                    </p>
                    <p className="mt-2 text-sm font-semibold text-black">
                      {opponentName}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {form.length ? (
                        form.slice(0, 5).map((result, index) => (
                          <span
                            key={`${result.opponent}-${index}`}
                            className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] ${outcomeStyles[result.outcome]}`}
                          >
                            {result.outcome}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-black/40">
                          No recent results
                        </span>
                      )}
                    </div>
                    <div className="mt-2 text-xs text-black/50">
                      {averages ? (
                        <>
                          Avg GF {averages.scoredPerGame.toFixed(1)} · Avg GA{" "}
                          {averages.concededPerGame.toFixed(1)}
                        </>
                      ) : (
                        "Avg GF — · Avg GA —"
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="mt-4 text-sm text-black/60">
              {hasPlayFootball
                ? "No upcoming fixtures for your team yet."
                : "Add PlayFootball URLs to pull fixtures."}
            </p>
          )}
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-3">
        <div className="rounded-[28px] border border-black/10 bg-white/80 p-6 shadow-sm">
          <p className="text-xs uppercase tracking-[0.3em] text-black/40">
            Top scorers
          </p>
          <div className="mt-4 flex flex-col gap-3">
            {topScorers.map((player) => (
              <div key={player.playerId} className="flex justify-between">
                <Link
                  href={`/player/${player.handle}`}
                  className="text-sm font-semibold text-black hover:underline"
                >
                  {player.displayName}
                </Link>
                <span className="text-sm text-black/70">{player.goals}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-[28px] border border-black/10 bg-white/80 p-6 shadow-sm">
          <p className="text-xs uppercase tracking-[0.3em] text-black/40">
            Top assisters
          </p>
          <div className="mt-4 flex flex-col gap-3">
            {topAssisters.map((player) => (
              <div key={player.playerId} className="flex justify-between">
                <Link
                  href={`/player/${player.handle}`}
                  className="text-sm font-semibold text-black hover:underline"
                >
                  {player.displayName}
                </Link>
                <span className="text-sm text-black/70">{player.assists}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-[28px] border border-black/10 bg-white/80 p-6 shadow-sm">
          <p className="text-xs uppercase tracking-[0.3em] text-black/40">
            Most owed
          </p>
          <div className="mt-4 flex flex-col gap-3">
            {mostOwed.map((player) => (
              <div key={player.playerId} className="flex justify-between">
                <Link
                  href={`/player/${player.handle}`}
                  className="text-sm font-semibold text-black hover:underline"
                >
                  {player.displayName}
                </Link>
                <span className="text-sm text-black/70">
                  {formatSignedGbp(player.owedPence)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
