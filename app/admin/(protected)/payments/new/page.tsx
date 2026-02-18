import { desc, eq } from "drizzle-orm";
import Script from "next/script";

import { db } from "@/db";
import { payments, players, seasons } from "@/db/schema";
import { formatGbp, penceToPounds } from "@/lib/money";
import { getSeasonLeaderboard } from "@/lib/stats";

export const dynamic = "force-dynamic";

export default async function AdminPaymentsPage() {
  const [seasonRows, playerRows, recentPayments] = await Promise.all([
    db.select().from(seasons).orderBy(desc(seasons.isActive), desc(seasons.startDate)),
    db
      .select()
      .from(players)
      .where(eq(players.isActive, true))
      .orderBy(players.displayName),
    db
      .select({
        id: payments.id,
        amountGbp: payments.amountGbp,
        paidAt: payments.paidAt,
        playerName: players.displayName,
        seasonName: seasons.name,
      })
      .from(payments)
      .innerJoin(players, eq(players.id, payments.playerId))
      .innerJoin(seasons, eq(seasons.id, payments.seasonId))
      .orderBy(desc(payments.paidAt))
      .limit(5),
  ]);

  const seasonLedgers = await Promise.all(
    seasonRows.map((season) => getSeasonLeaderboard(season.id))
  );
  const ledgerBySeason = new Map(
    seasonRows.map((season, index) => [season.id, seasonLedgers[index]])
  );

  const activeSeason = seasonRows.find((season) => season.isActive) ?? seasonRows[0];
  const activeLedger = activeSeason
    ? ledgerBySeason.get(activeSeason.id) ?? []
    : [];
  const activeBalances = activeLedger
    .filter((row) => row.isActive && row.owedPence > 0)
    .sort((a, b) => b.owedPence - a.owedPence);

  const owedBySeason: Record<string, Record<string, number>> = {};
  for (const [seasonId, ledger] of ledgerBySeason.entries()) {
    const seasonKey = String(seasonId);
    owedBySeason[seasonKey] = {};
    for (const row of ledger) {
      owedBySeason[seasonKey][String(row.playerId)] = row.owedPence;
    }
  }

  const defaultSeasonId = activeSeason?.id ?? seasonRows[0]?.id ?? null;
  const defaultPlayerId = playerRows[0]?.id ?? null;
  const defaultOwedPence =
    defaultSeasonId && defaultPlayerId
      ? owedBySeason[String(defaultSeasonId)]?.[String(defaultPlayerId)] ?? 0
      : 0;

  return (
    <div className="flex flex-col gap-8">
      {activeSeason ? (
        <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="flex flex-col gap-2">
            <h2 className="text-lg font-semibold">Quick settle</h2>
            <p className="text-sm text-white/60">
              One-click full payments for total outstanding balances.
            </p>
          </div>
          <div className="mt-4 flex flex-col gap-3">
            {activeBalances.length ? (
              activeBalances.map((row) => (
                <div
                  key={row.playerId}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm"
                >
                  <div className="flex flex-col">
                    <span className="font-semibold text-white">
                      {row.displayName}
                    </span>
                    <span className="text-xs text-white/60">
                      Owes {formatGbp(row.owedPence)}
                    </span>
                  </div>
                  <form action="/admin/payments/new/submit" method="post">
                    <input type="hidden" name="playerId" value={row.playerId} />
                    <input
                      type="hidden"
                      name="seasonId"
                      value={activeSeason.id}
                    />
                    <input
                      type="hidden"
                      name="amountGbp"
                      value={penceToPounds(row.owedPence)}
                    />
                    <input
                      type="hidden"
                      name="note"
                      value="Full balance payment"
                    />
                    <button className="rounded-full border border-lime-300/40 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-lime-200 hover:border-lime-200">
                      Mark paid
                    </button>
                  </form>
                </div>
              ))
            ) : (
              <p className="text-sm text-white/60">No balances outstanding.</p>
            )}
          </div>
        </section>
      ) : null}

      <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <h2 className="text-lg font-semibold">Log payment</h2>
        <form
          action="/admin/payments/new/submit"
          method="post"
          className="mt-4 grid gap-3 md:grid-cols-2"
          data-payment-form
          data-owed-map={JSON.stringify(owedBySeason)}
        >
          <label className="flex flex-col gap-2 text-sm text-white/70">
            Player
            <select
              name="playerId"
              className="rounded-2xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white"
              defaultValue={defaultPlayerId ?? undefined}
            >
              {playerRows.map((player) => (
                <option key={player.id} value={player.id}>
                  {player.displayName}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-2 text-sm text-white/70">
            Season
            <select
              name="seasonId"
              className="rounded-2xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white"
              defaultValue={defaultSeasonId ?? undefined}
            >
              {seasonRows.map((season) => (
                <option key={season.id} value={season.id}>
                  {season.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-2 text-sm text-white/70">
            Amount (GBP)
            <input
              name="amountGbp"
              type="number"
              step="0.01"
              defaultValue={
                defaultOwedPence > 0 ? penceToPounds(defaultOwedPence) : ""
              }
              className="rounded-2xl border border-white/10 bg-white/10 px-3 py-2 text-sm"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm text-white/70 md:col-span-2">
            Note (optional, admin-only)
            <input
              name="note"
              className="rounded-2xl border border-white/10 bg-white/10 px-3 py-2 text-sm"
            />
          </label>
          <button className="rounded-2xl bg-lime-300 px-4 py-2 text-sm font-semibold uppercase tracking-wide text-slate-900">
            Save payment
          </button>
        </form>
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <h2 className="text-lg font-semibold">Recent payments</h2>
        <div className="mt-4 flex flex-col gap-3">
          {recentPayments.map((payment) => (
            <div
              key={payment.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm"
            >
              <div className="flex flex-col">
                <span className="font-semibold text-white">
                  {payment.playerName}
                </span>
                <span className="text-xs text-white/60">{payment.seasonName}</span>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right text-white/70">
                  <p className="text-base font-semibold">£{payment.amountGbp}</p>
                  <p className="text-xs">
                    {payment.paidAt.toISOString().slice(0, 10)}
                  </p>
                </div>
                <form action="/admin/payments/delete" method="post">
                  <input type="hidden" name="paymentId" value={payment.id} />
                  <button className="rounded-full border border-rose-300/40 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-rose-100 hover:border-rose-300/70">
                    Delete
                  </button>
                </form>
              </div>
            </div>
          ))}
        </div>
      </section>

      <Script id="payment-owed-defaults" strategy="afterInteractive">{`
        (function() {
          var form = document.querySelector('[data-payment-form]');
          if (!form) return;
          var owedRaw = form.getAttribute('data-owed-map') || '{}';
          var owed = {};
          try { owed = JSON.parse(owedRaw); } catch (e) { owed = {}; }
          var playerSelect = form.querySelector('[name="playerId"]');
          var seasonSelect = form.querySelector('[name="seasonId"]');
          var amountInput = form.querySelector('[name="amountGbp"]');

          function updateAmount() {
            if (!playerSelect || !seasonSelect || !amountInput) return;
            var seasonId = seasonSelect.value;
            var playerId = playerSelect.value;
            var pence = 0;
            if (owed[seasonId] && owed[seasonId][playerId] !== undefined) {
              pence = owed[seasonId][playerId];
            }
            if (pence > 0) {
              amountInput.value = (pence / 100).toFixed(2);
            } else {
              amountInput.value = '';
            }
          }

          if (playerSelect) playerSelect.addEventListener('change', updateAmount);
          if (seasonSelect) seasonSelect.addEventListener('change', updateAmount);
          updateAmount();
        })();
      `}</Script>
    </div>
  );
}