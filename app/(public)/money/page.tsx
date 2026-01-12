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
          Balances for each player this season.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <div className="grid text-xs uppercase tracking-[0.2em] text-black/50">
          <div className="grid grid-cols-[minmax(0,1fr)_72px_96px] items-center md:grid-cols-[minmax(0,1fr)_120px_140px]">
            <span>Player</span>
            <span className="text-right">Owed</span>
            <span className="text-right">Settle</span>
          </div>
        </div>
        <div className="grid gap-2 text-sm text-black/70">
          {rows.map((row) => {
            const showPayButton = row.owedPence > 0;
            const showCredit = row.owedPence < 0;
            return (
              <div
                key={row.playerId}
                className="grid grid-cols-[minmax(0,1fr)_72px_96px] items-center gap-2 rounded-2xl border border-black/5 bg-white/70 px-3 py-3 md:grid-cols-[minmax(0,1fr)_120px_140px]"
              >
                <Link
                  href={`/player/${row.handle}`}
                  className="min-w-0 text-sm font-semibold text-black hover:text-black/70"
                >
                  <span className="block truncate">{row.displayName}</span>
                </Link>
                <span className="text-right text-sm font-semibold text-black">
                  {formatSignedGbp(row.owedPence)}
                </span>
                <div className="text-right text-[10px] uppercase tracking-[0.2em] md:text-xs">
                  {showPayButton ? (
                    <a
                      href={buildMonzoLink(row.owedPence)}
                      className="inline-flex rounded-full bg-black px-2 py-2 text-white md:px-3"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Settle up
                    </a>
                  ) : showCredit ? (
                    <span className="inline-flex rounded-full border border-black/10 px-2 py-2 text-black/60 md:px-3">
                      Credit
                    </span>
                  ) : (
                    <span className="inline-flex rounded-full border border-black/10 px-2 py-2 text-black/60 md:px-3">
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
