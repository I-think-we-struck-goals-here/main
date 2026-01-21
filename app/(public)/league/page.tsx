import LeaderboardPanel from "@/components/LeaderboardPanel";
import {
  filterFixturesForTeam,
  formatPlayFootballTeamName,
  getFixtureOpponent,
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
  const fixtures = filterFixturesForTeam(snapshot?.fixtures ?? [], selectedSeason);
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
                return (
                  <div
                    key={row.team}
                    className={`grid grid-cols-[24px_1fr_32px_32px_32px_40px] items-center rounded-xl px-2 py-2 ${
                      isTeam ? "bg-lime-200/70 text-black" : "text-black/70"
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
              No cached standings yet for this season.
            </p>
          )}
        </div>
        <div className="rounded-[28px] border border-black/10 bg-white/80 p-6 shadow-sm">
          <p className="text-xs uppercase tracking-[0.3em] text-black/40">
            Fixtures
          </p>
          {fixtures.length ? (
            <div className="mt-4 flex flex-col gap-3 text-sm text-black/70">
              {fixtures.slice(0, 10).map((fixture) => {
                const { opponent, venueLabel } = getFixtureOpponent(
                  fixture,
                  selectedSeason
                );
                return (
                  <div
                    key={`${fixture.dateLabel}-${fixture.time}-${fixture.home}-${fixture.away}`}
                    className="rounded-2xl border border-black/5 bg-black/[0.02] p-3"
                  >
                    <p className="text-xs uppercase tracking-[0.2em] text-black/50">
                      {fixture.dateLabel} · {fixture.time}
                    </p>
                    <p className="mt-2 text-sm font-semibold text-black">
                      {opponent}
                    </p>
                    {venueLabel ? (
                      <p className="mt-1 text-xs uppercase tracking-[0.2em] text-black/40">
                        {venueLabel}
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="mt-4 text-sm text-black/60">
              No upcoming fixtures for your team yet.
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
