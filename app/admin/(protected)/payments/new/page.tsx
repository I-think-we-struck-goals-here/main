import { desc, eq, sql } from "drizzle-orm";
import Script from "next/script";

import { db } from "@/db";
import { payments, players, seasons } from "@/db/schema";
import { formatGbp, formatSignedGbp, penceToPounds, poundsToPence } from "@/lib/money";
import { getOutstandingBalances } from "@/lib/stats";

export const dynamic = "force-dynamic";

export default async function AdminPaymentsPage() {
  const [seasonRows, playerRows, recentPayments, balances, paymentTotals] = await Promise.all([
    db.select().from(seasons).orderBy(desc(seasons.isActive), desc(seasons.startDate)),
    db
      .select()
      .from(players)
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
    getOutstandingBalances(),
    db
      .select({
        playerId: payments.playerId,
        totalPaidGbp: sql<string>`coalesce(sum(${payments.amountGbp}), 0)`,
      })
      .from(payments)
      .groupBy(payments.playerId),
  ]);

  const activeSeason = seasonRows.find((season) => season.isActive) ?? seasonRows[0];
  const seasonsByDate = [...seasonRows].sort((a, b) => {
    const aStart = a.startDate ?? "";
    const bStart = b.startDate ?? "";
    if (aStart === bStart) {
      return b.id - a.id;
    }
    return aStart < bStart ? 1 : -1;
  });
  const today = new Date().toISOString().slice(0, 10);
  const currentSeasonByDate =
    seasonsByDate.find((season) => {
      const startsBeforeOrToday = !season.startDate || season.startDate <= today;
      const endsAfterOrToday = !season.endDate || season.endDate >= today;
      return startsBeforeOrToday && endsAfterOrToday;
    }) ?? null;
  const defaultSeason = currentSeasonByDate ?? activeSeason ?? seasonsByDate[0];

  const quickSettleBalances = balances
    .filter((row) => row.owedPence > 0)
    .sort((a, b) => b.owedPence - a.owedPence);

  const owedByPlayer: Record<string, number> = {};
  for (const row of balances) {
    owedByPlayer[String(row.playerId)] = row.owedPence;
  }

  const paidByPlayer: Record<string, number> = {};
  for (const row of paymentTotals) {
    paidByPlayer[String(row.playerId)] = poundsToPence(row.totalPaidGbp);
  }

  const reconciliationRows = balances
    .map((row) => {
      const totalPaidPence = paidByPlayer[String(row.playerId)] ?? 0;
      return {
        ...row,
        totalPaidPence,
        totalChargedPence: totalPaidPence + row.owedPence,
      };
    })
    .filter((row) => row.totalPaidPence !== 0 || row.owedPence !== 0)
    .sort((a, b) => a.displayName.localeCompare(b.displayName));

  const defaultSeasonId = defaultSeason?.id ?? seasonRows[0]?.id ?? null;
  const defaultPlayerId =
    quickSettleBalances[0]?.playerId ??
    playerRows.find((player) => player.isActive)?.id ??
    playerRows[0]?.id ??
    null;
  const defaultOwedPence =
    defaultPlayerId
      ? owedByPlayer[String(defaultPlayerId)] ?? 0
      : 0;

  return (
    <div className="flex flex-col gap-8">
      {defaultSeason ? (
        <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="flex flex-col gap-2">
            <h2 className="text-lg font-semibold">Quick settle</h2>
            <p className="text-sm text-white/60">
              One-click full payments for total outstanding balances.
            </p>
          </div>
          <div className="mt-4 flex flex-col gap-3">
            {quickSettleBalances.length ? (
              quickSettleBalances.map((row) => (
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
                    {!row.isActive ? (
                      <span className="text-[10px] uppercase tracking-[0.16em] text-amber-200/80">
                        Inactive
                      </span>
                    ) : null}
                  </div>
                  <form action="/admin/payments/new/submit" method="post">
                    <input type="hidden" name="playerId" value={row.playerId} />
                    <input
                      type="hidden"
                      name="seasonId"
                      value={defaultSeason.id}
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
          data-owed-map={JSON.stringify(owedByPlayer)}
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
                  {!player.isActive ? " (inactive)" : ""}
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
        <h2 className="text-lg font-semibold">Paid vs outstanding</h2>
        <p className="mt-1 text-sm text-white/60">
          Totals across all seasons, by player.
        </p>
        <div className="mt-4 flex flex-col gap-3">
          {reconciliationRows.length ? (
            reconciliationRows.map((row) => (
              <div
                key={row.playerId}
                className="grid grid-cols-1 gap-3 rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm md:grid-cols-[minmax(0,1fr)_auto_auto_auto]"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold text-white">
                    {row.displayName}
                  </p>
                  <p className="text-xs text-white/50">
                    Charged {formatGbp(row.totalChargedPence)}
                    {!row.isActive ? " • inactive" : ""}
                  </p>
                </div>
                <p className="text-right text-white/80">
                  Paid {formatGbp(row.totalPaidPence)}
                </p>
                <p className="text-right text-white/80">
                  Outstanding {formatSignedGbp(row.owedPence)}
                </p>
                <div className="text-right">
                  {row.owedPence > 0 ? (
                    <form action="/admin/payments/new/submit" method="post">
                      <input type="hidden" name="playerId" value={row.playerId} />
                      <input
                        type="hidden"
                        name="seasonId"
                        value={defaultSeasonId ?? ""}
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
                      <button
                        className="rounded-full border border-lime-300/40 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-lime-200 hover:border-lime-200"
                        disabled={!defaultSeasonId}
                      >
                        Mark paid
                      </button>
                    </form>
                  ) : (
                    <span className="text-xs text-white/50">Settled</span>
                  )}
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-white/60">No paid or outstanding records yet.</p>
          )}
        </div>
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
          var amountInput = form.querySelector('[name="amountGbp"]');

          function updateAmount() {
            if (!playerSelect || !amountInput) return;
            var playerId = playerSelect.value;
            var pence = owed[playerId] !== undefined ? owed[playerId] : 0;
            if (pence > 0) {
              amountInput.value = (pence / 100).toFixed(2);
            } else {
              amountInput.value = '';
            }
          }

          if (playerSelect) playerSelect.addEventListener('change', updateAmount);
          updateAmount();
        })();
      `}</Script>
    </div>
  );
}
