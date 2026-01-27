import {
  buildTeamResults,
  computeTeamElo,
  filterFixturesForTeam,
  formatPlayFootballTeamName,
  getFixtureOpponent,
  getPlayFootballSnapshot,
  getPlayFootballTeamName,
  normalizePlayFootballTeamName,
} from "@/lib/playfootball";
import { getActiveSeason } from "@/lib/stats";

export const dynamic = "force-dynamic";

const FORFEIT_TEAM = "Call Now To Enter 01702 414079";

const outcomeStyles: Record<"W" | "D" | "L", string> = {
  W: "bg-emerald-400/15 text-emerald-200 border-emerald-400/30",
  D: "bg-amber-400/15 text-amber-200 border-amber-400/30",
  L: "bg-rose-400/15 text-rose-200 border-rose-400/30",
};

const formatDateTime = (kickoffAt?: string | null) => {
  if (!kickoffAt) {
    return "TBC";
  }
  const parsed = new Date(kickoffAt);
  if (Number.isNaN(parsed.getTime())) {
    return "TBC";
  }
  return parsed.toLocaleString("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default async function AdminInsightsPage() {
  const activeSeason = await getActiveSeason();

  if (!activeSeason) {
    return (
      <section className="rounded-3xl border border-white/10 bg-white/5 p-6 text-white">
        <h2 className="text-lg font-semibold">No active season</h2>
        <p className="text-sm text-white/60">
          Create a season before generating opponent insights.
        </p>
      </section>
    );
  }

  const snapshot = await getPlayFootballSnapshot(activeSeason);
  if (!snapshot) {
    return (
      <section className="rounded-3xl border border-white/10 bg-white/5 p-6 text-white">
        <h2 className="text-lg font-semibold">No PlayFootball snapshot</h2>
        <p className="text-sm text-white/60">
          Add PlayFootball URLs and refresh the snapshot first.
        </p>
      </section>
    );
  }

  const standings = snapshot.standings.map((row) =>
    formatPlayFootballTeamName(row.team)
  );
  const resultsByTeam = buildTeamResults(snapshot.fixtures, {
    activeTeams: standings,
    forfeitTeam: FORFEIT_TEAM,
    forfeitScore: [8, 0],
  });
  const eloByTeam = computeTeamElo(snapshot.fixtures, {
    activeTeams: standings,
    forfeitTeam: FORFEIT_TEAM,
    forfeitScore: [8, 0],
  });

  const teamName = getPlayFootballTeamName(activeSeason);
  const teamNorm = normalizePlayFootballTeamName(teamName);
  const ourElo = eloByTeam.get(teamNorm);
  const now = Date.now();

  const upcomingFixtures = filterFixturesForTeam(
    snapshot.fixtures,
    activeSeason
  )
    .filter((fixture) => {
      if (!fixture.kickoffAt) {
        return true;
      }
      return Date.parse(fixture.kickoffAt) >= now;
    })
    .slice(0, 6);

  const teamRows = standings
    .map((team) => {
      const normalized = normalizePlayFootballTeamName(team);
      const rating = eloByTeam.get(normalized);
      const form = resultsByTeam.get(normalized) ?? [];
      return {
        team,
        normalized,
        rating,
        form: form.slice(0, 5),
      };
    })
    .filter((row) => row.rating)
    .sort((a, b) => (b.rating?.rating ?? 0) - (a.rating?.rating ?? 0));

  return (
    <div className="flex flex-col gap-8">
      <section className="rounded-3xl border border-white/10 bg-white/5 p-6 text-white">
        <div className="flex flex-col gap-2">
          <p className="text-xs uppercase tracking-[0.3em] text-white/50">
            Opponent insights
          </p>
          <h2 className="text-2xl font-semibold">Upcoming fixtures</h2>
          <p className="text-sm text-white/60">
            Last 5 form and Elo ratings (forfeits + exited teams removed).
          </p>
        </div>
        <div className="mt-6 grid gap-4">
          {upcomingFixtures.map((fixture) => {
            const { opponent } = getFixtureOpponent(fixture, activeSeason);
            const opponentName = formatPlayFootballTeamName(opponent);
            const opponentNorm = normalizePlayFootballTeamName(opponentName);
            const form = resultsByTeam.get(opponentNorm) ?? [];
            const opponentElo = eloByTeam.get(opponentNorm);
            const confidence =
              ourElo && opponentElo
                ? Math.min(
                    1,
                    (ourElo.games + opponentElo.games) / 16
                  )
                : 0;

            return (
              <div
                key={`${fixture.dateLabel}-${fixture.time}-${fixture.home}-${fixture.away}`}
                className="rounded-2xl border border-white/10 bg-slate-950/60 p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-white/50">
                      {formatDateTime(fixture.kickoffAt)}
                    </p>
                    <p className="mt-2 text-base font-semibold text-white">
                      {opponentName}
                    </p>
                  </div>
                  <div className="text-right text-xs text-white/60">
                    <p>Elo: {opponentElo ? Math.round(opponentElo.rating) : "—"}</p>
                    <p>
                      Confidence: {Math.round(confidence * 100)}%
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {form.length ? (
                    form.map((result, index) => (
                      <span
                        key={`${result.opponent}-${index}`}
                        className={`rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] ${
                          outcomeStyles[result.outcome]
                        }`}
                      >
                        {result.outcome}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-white/40">No recent results</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/5 p-6 text-white">
        <div className="flex flex-col gap-2">
          <p className="text-xs uppercase tracking-[0.3em] text-white/50">
            League strength
          </p>
          <h2 className="text-2xl font-semibold">Elo ratings</h2>
          <p className="text-sm text-white/60">
            Ratings update chronologically from all recorded results.
          </p>
        </div>
        <div className="mt-5 grid gap-2 text-sm">
          <div className="grid grid-cols-[1.5fr_80px_80px_1fr] items-center text-[10px] uppercase tracking-[0.2em] text-white/40">
            <span>Team</span>
            <span className="text-right">Elo</span>
            <span className="text-right">GP</span>
            <span className="text-right">Form</span>
          </div>
          {teamRows.map((row) => (
            <div
              key={row.normalized}
              className="grid grid-cols-[1.5fr_80px_80px_1fr] items-center rounded-xl border border-white/10 bg-slate-950/50 px-3 py-2"
            >
              <span className="text-sm font-semibold">{row.team}</span>
              <span className="text-right text-sm text-white/80">
                {Math.round(row.rating?.rating ?? 0)}
              </span>
              <span className="text-right text-sm text-white/60">
                {row.rating?.games ?? 0}
              </span>
              <div className="flex justify-end gap-1">
                {row.form.length ? (
                  row.form.map((result, index) => (
                    <span
                      key={`${row.team}-${index}`}
                      className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] ${
                        outcomeStyles[result.outcome]
                      }`}
                    >
                      {result.outcome}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-white/40">—</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
