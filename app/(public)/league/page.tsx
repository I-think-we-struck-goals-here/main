import { getPlayFootballSnapshot, isPlayFootballTeam } from "@/lib/playfootball";
import { getActiveSeason } from "@/lib/stats";

export const dynamic = "force-dynamic";

export default async function LeaguePage() {
  const activeSeason = await getActiveSeason();

  if (!activeSeason) {
    return (
      <section className="rounded-[32px] border border-black/10 bg-white/90 p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">League data unavailable</h1>
        <p className="mt-2 text-sm text-black/60">
          Create a season first, then enable PlayFootball syncing.
        </p>
      </section>
    );
  }

  const snapshot = await getPlayFootballSnapshot(activeSeason);

  if (!snapshot || snapshot.standings.length === 0) {
    return (
      <section className="rounded-[32px] border border-black/10 bg-white/90 p-8 shadow-sm">
        <p className="text-xs uppercase tracking-[0.3em] text-black/40">
          League
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-black">
          No cached snapshot
        </h1>
        <p className="mt-2 text-sm text-black/60">
          When PlayFootball syncing is enabled, fixtures and standings will show
          here.
        </p>
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-[32px] border border-black/10 bg-white/90 p-8 shadow-sm">
        <p className="text-xs uppercase tracking-[0.3em] text-black/40">
          League
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-black">
          Standings & fixtures
        </h1>
        <p className="mt-2 text-sm text-black/60">
          Last updated: {new Date(snapshot.fetchedAt).toLocaleString("en-GB")}
        </p>
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <div className="rounded-[28px] border border-black/10 bg-white/80 p-6 shadow-sm">
          <p className="text-xs uppercase tracking-[0.3em] text-black/40">
            Standings
          </p>
          <div className="mt-4 grid gap-2 text-xs">
            <div className="grid grid-cols-[24px_1fr_32px_32px_32px_40px] items-center text-[10px] uppercase tracking-[0.2em] text-black/50">
              <span>#</span>
              <span>Team</span>
              <span className="text-right">P</span>
              <span className="text-right">GD</span>
              <span className="text-right">GF</span>
              <span className="text-right">Pts</span>
            </div>
            {snapshot.standings.map((row) => {
              const isTeam = isPlayFootballTeam(row.team);
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
                  <span className="text-xs font-semibold">{row.team}</span>
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
        </div>
        <div className="rounded-[28px] border border-black/10 bg-white/80 p-6 shadow-sm">
          <p className="text-xs uppercase tracking-[0.3em] text-black/40">
            Fixtures
          </p>
          <div className="mt-4 flex flex-col gap-3 text-sm text-black/70">
            {snapshot.fixtures.slice(0, 10).map((fixture) => (
              <div
                key={`${fixture.dateLabel}-${fixture.time}-${fixture.home}-${fixture.away}`}
                className="rounded-2xl border border-black/5 bg-black/[0.02] p-3"
              >
                <p className="text-xs uppercase tracking-[0.2em] text-black/50">
                  {fixture.dateLabel} · {fixture.time}
                </p>
                <p className="mt-2 text-sm font-semibold text-black">
                  {fixture.home} vs {fixture.away}
                </p>
                {fixture.pitch ? (
                  <p className="mt-1 text-xs text-black/50">
                    {fixture.pitch}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-black/50">
            Data from PlayFootball (cached).
          </p>
        </div>
      </section>
    </div>
  );
}
