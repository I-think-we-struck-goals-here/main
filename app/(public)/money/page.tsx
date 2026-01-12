import Link from "next/link";

import { buildMonzoLink, formatSignedGbp } from "@/lib/money";
import { getActiveSeason, getSeasonLeaderboard } from "@/lib/stats";

export const dynamic = "force-dynamic";

export default async function MoneyPage() {
  const activeSeason = await getActiveSeason();

  if (!activeSeason) {
    return (
      <section className="rounded-[32px] border border-black/10 bg-white/90 p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">No season yet</h1>
        <p className="mt-2 text-sm text-black/60">
          Create a season in the admin area to start tracking balances.
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

  const leaderboard = await getSeasonLeaderboard(activeSeason.id);
  const rows = [...leaderboard].sort((a, b) => b.owedPence - a.owedPence);

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-[32px] border border-black/10 bg-white/90 p-8 shadow-sm">
        <p className="text-xs uppercase tracking-[0.3em] text-black/40">
          Money
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-black">
          Balances for {activeSeason.name}
        </h1>
        <p className="mt-2 text-sm text-black/60">
          Public balances for each player this season.
        </p>
      </section>

      <section className="rounded-[28px] border border-black/10 bg-white/80 p-6 shadow-sm">
        <div className="grid gap-2 text-xs uppercase tracking-[0.2em] text-black/50">
          <div className="grid grid-cols-[1fr_120px_140px] items-center">
            <span>Player</span>
            <span className="text-right">Owed</span>
            <span className="text-right">Settle</span>
          </div>
        </div>
        <div className="mt-4 grid gap-2 text-sm text-black/70">
          {rows.map((row) => {
            const showPayButton = row.owedPence > 0;
            const showCredit = row.owedPence < 0;
            return (
              <div
                key={row.playerId}
                className="grid grid-cols-[1fr_120px_140px] items-center rounded-2xl border border-black/5 bg-black/[0.02] px-3 py-3"
              >
                <Link
                  href={`/player/${row.handle}`}
                  className="text-sm font-semibold text-black hover:text-black/70"
                >
                  {row.displayName}
                </Link>
                <span className="text-right text-sm font-semibold text-black">
                  {formatSignedGbp(row.owedPence)}
                </span>
                <div className="text-right text-xs uppercase tracking-[0.2em]">
                  {showPayButton ? (
                    <a
                      href={buildMonzoLink(row.owedPence)}
                      className="inline-flex rounded-full bg-black px-3 py-2 text-white"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Settle up
                    </a>
                  ) : showCredit ? (
                    <span className="inline-flex rounded-full border border-black/10 px-3 py-2 text-black/60">
                      Credit
                    </span>
                  ) : (
                    <span className="inline-flex rounded-full border border-black/10 px-3 py-2 text-black/60">
                      All square
                    </span>
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
