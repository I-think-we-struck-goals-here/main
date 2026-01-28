import {
  buildTeamResults,
  computeTeamElo,
  formatPlayFootballTeamName,
  getPlayFootballSnapshot,
  isPlayFootballTeam,
  normalizePlayFootballTeamName,
} from "@/lib/playfootball";
import { getActiveSeason } from "@/lib/stats";

export const dynamic = "force-dynamic";

const FORFEIT_TEAM = "Call Now To Enter 01702 414079";

const formatSigned = (value: number, digits = 1) =>
  `${value >= 0 ? "+" : ""}${value.toFixed(digits)}`;

const outcomeStyles: Record<"W" | "D" | "L", string> = {
  W: "bg-emerald-500/15 text-emerald-700 border-emerald-500/40",
  D: "bg-amber-400/20 text-amber-700 border-amber-400/40",
  L: "bg-rose-500/15 text-rose-700 border-rose-500/40",
};

export default async function StatsPage() {
  const activeSeason = await getActiveSeason();

  if (!activeSeason) {
    return (
      <section className="rounded-[32px] border border-black/10 bg-white/80 p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">No season yet</h1>
        <p className="mt-2 text-sm text-black/60">
          Create a season in the admin area to start tracking stats.
        </p>
      </section>
    );
  }

  const snapshot = await getPlayFootballSnapshot(activeSeason);
  if (!snapshot) {
    return (
      <section className="rounded-[32px] border border-black/10 bg-white/80 p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">No PlayFootball data yet</h1>
        <p className="mt-2 text-sm text-black/60">
          Add the PlayFootball URLs and refresh the snapshot first.
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

  const activeSet = new Set(standings.map(normalizePlayFootballTeamName));
  const forfeitNorm = normalizePlayFootballTeamName(FORFEIT_TEAM);
  const includedFixtures = snapshot.fixtures.filter((fixture) => {
    if (fixture.scoreHome === null || fixture.scoreAway === null) {
      return false;
    }
    const homeNorm = normalizePlayFootballTeamName(fixture.home);
    const awayNorm = normalizePlayFootballTeamName(fixture.away);
    if (!activeSet.has(homeNorm) || !activeSet.has(awayNorm)) {
      return false;
    }
    const isForfeitTeam = homeNorm === forfeitNorm || awayNorm === forfeitNorm;
    if (isForfeitTeam) {
      const [forfeitHome, forfeitAway] = [8, 0];
      const isForfeit =
        (fixture.scoreHome === forfeitHome &&
          fixture.scoreAway === forfeitAway) ||
        (fixture.scoreHome === forfeitAway &&
          fixture.scoreAway === forfeitHome);
      if (isForfeit) {
        return false;
      }
    }
    return true;
  });
  const drawRate = includedFixtures.length
    ? includedFixtures.filter(
        (fixture) => fixture.scoreHome === fixture.scoreAway
      ).length / includedFixtures.length
    : 0;
  const ratingValues = Array.from(eloByTeam.values()).map(
    (entry) => entry.rating
  );
  const averageRating = ratingValues.length
    ? ratingValues.reduce((total, value) => total + value, 0) /
      ratingValues.length
    : 1000;

  const teamRows = standings
    .map((team) => {
      const normalized = normalizePlayFootballTeamName(team);
      const rating = eloByTeam.get(normalized);
      const results = resultsByTeam.get(normalized) ?? [];
      const form = results.slice(0, 5);
      const points = results.reduce((total, result) => {
        if (result.outcome === "W") {
          return total + 3;
        }
        if (result.outcome === "D") {
          return total + 1;
        }
        return total;
      }, 0);
      const games = results.length;
      const ppg = games ? points / games : 0;
      const winProb =
        rating && Number.isFinite(rating.rating)
          ? 1 / (1 + Math.pow(10, (averageRating - rating.rating) / 400))
          : null;
      const expectedPpg =
        winProb !== null
          ? (1 - drawRate) * winProb * 3 + drawRate * 1
          : null;
      const diff =
        expectedPpg !== null && games
          ? ppg - expectedPpg
          : null;
      const ratingDiff =
        rating && Number.isFinite(rating.rating)
          ? rating.rating - averageRating
          : null;
      return {
        team,
        normalized,
        rating,
        form,
        stats: {
          winProb,
          expectedPpg,
          diff,
          ratingDiff,
        },
      };
    })
    .filter((row) => row.rating)
    .sort((a, b) => (b.rating?.rating ?? 0) - (a.rating?.rating ?? 0));

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-4">
        <input id="elo-details" type="checkbox" className="peer sr-only" />
        <div className="flex flex-col gap-2">
          <p className="text-xs uppercase tracking-[0.3em] text-black/40">
            League stats
          </p>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-2xl font-semibold">Elo ratings</h1>
            <label
              htmlFor="elo-details"
              className="rounded-full border border-black/10 bg-white px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-black/60 hover:border-black/30"
            >
              Toggle details
            </label>
          </div>
        </div>
        <div className="grid gap-2 text-sm peer-checked:[&_.elo-details]:flex">
          <div className="grid grid-cols-[1.6fr_72px_56px] items-center text-[10px] uppercase tracking-[0.2em] text-black/40 md:grid-cols-[1.5fr_80px_80px_1fr]">
            <span>Team</span>
            <span className="text-right tabular-nums">Elo</span>
            <span className="text-right tabular-nums">GP</span>
            <span className="hidden text-right md:block">Form</span>
          </div>
          {teamRows.map((row) => {
            const isTeam = isPlayFootballTeam(row.team, activeSeason);
            return (
              <div
                key={row.normalized}
                className={`rounded-2xl border px-3 py-2 ${
                  isTeam
                    ? "border-lime-300/60 bg-lime-100/80"
                    : "border-black/10 bg-white"
                }`}
              >
                <div className="grid grid-cols-[1.6fr_72px_56px] items-center md:grid-cols-[1.5fr_80px_80px_1fr]">
                  <span className="text-sm font-semibold text-black">
                    {row.team}
                  </span>
                  <span className="text-right text-sm text-black/80 tabular-nums">
                    {Math.round(row.rating?.rating ?? 0)}
                  </span>
                  <span className="text-right text-sm text-black/60 tabular-nums">
                    {row.rating?.games ?? 0}
                  </span>
                  <div className="hidden justify-end gap-1 md:flex">
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
                      <span className="text-xs text-black/40">—</span>
                    )}
                  </div>
                </div>
                <div className="elo-details mt-2 hidden flex-wrap items-center gap-2 text-[11px] text-black/60">
                  <span>
                    Win%{" "}
                    {row.stats.winProb !== null
                      ? Math.round(row.stats.winProb * 100)
                      : "—"}
                  </span>
                  <span>·</span>
                  <span>
                    Exp Pts{" "}
                    {row.stats.expectedPpg !== null
                      ? row.stats.expectedPpg.toFixed(2)
                      : "—"}
                  </span>
                  <span>·</span>
                  <span>
                    Diff{" "}
                    {row.stats.diff !== null
                      ? formatSigned(row.stats.diff, 2)
                      : "—"}
                  </span>
                  <span>·</span>
                  <span>
                    Elo Δ{" "}
                    {row.stats.ratingDiff !== null
                      ? formatSigned(row.stats.ratingDiff, 0)
                      : "—"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-xs text-black/50">
          Elo updates from every recorded result (K=20), ignoring 8-0 forfeits vs
          "{FORFEIT_TEAM}". Toggle details shows win probability versus the
          league average, expected points per game, and the difference from
          actual points.
        </p>
      </section>
    </div>
  );
}
