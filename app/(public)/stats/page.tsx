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
      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <p className="text-xs uppercase tracking-[0.3em] text-black/40">
            League stats
          </p>
          <h1 className="text-2xl font-semibold">Elo ratings</h1>
          <p className="text-sm text-black/60">
            Elo updates from every recorded result (K=20), ignoring 8-0
            forfeits vs "{FORFEIT_TEAM}".
          </p>
        </div>
        <div className="grid gap-2 text-sm">
          <div className="grid grid-cols-[1.6fr_72px_52px] items-center text-[10px] uppercase tracking-[0.2em] text-black/40 md:grid-cols-[1.5fr_80px_80px_1fr]">
            <span>Team</span>
            <span className="text-right">Elo</span>
            <span className="text-right">GP</span>
            <span className="hidden text-right md:block">Form</span>
          </div>
          {teamRows.map((row) => {
            const isTeam = isPlayFootballTeam(row.team, activeSeason);
            return (
              <div
                key={row.normalized}
                className={`grid grid-cols-[1.6fr_72px_52px] items-center rounded-2xl border px-3 py-2 md:grid-cols-[1.5fr_80px_80px_1fr] ${
                  isTeam
                    ? "border-lime-300/60 bg-lime-100/80"
                    : "border-black/10 bg-white"
                }`}
              >
                <span className="text-sm font-semibold text-black">
                  {row.team}
                </span>
                <span className="text-right text-sm text-black/80">
                  {Math.round(row.rating?.rating ?? 0)}
                </span>
                <span className="text-right text-sm text-black/60">
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
            );
          })}
        </div>
      </section>
    </div>
  );
}
