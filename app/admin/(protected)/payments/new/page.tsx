import { desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { payments, players, seasons } from "@/db/schema";

import { createPayment } from "./actions";

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

  return (
    <div className="flex flex-col gap-8">
      <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <h2 className="text-lg font-semibold">Log payment</h2>
        <form
          action={createPayment}
          className="mt-4 grid gap-3 md:grid-cols-2"
        >
          <label className="flex flex-col gap-2 text-sm text-white/70">
            Player
            <select
              name="playerId"
              className="rounded-2xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white"
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
              className="rounded-2xl border border-white/10 bg-white/10 px-3 py-2 text-sm"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm text-white/70">
            Paid at
            <input
              name="paidAt"
              type="date"
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
              <div className="text-right text-white/70">
                <p className="text-base font-semibold">£{payment.amountGbp}</p>
                <p className="text-xs">
                  {payment.paidAt.toISOString().slice(0, 10)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
