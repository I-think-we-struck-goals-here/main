import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { payments, players } from "@/db/schema";
import { formatGbp } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function AdminPaymentTotalsPage() {
  const totalPaidPenceExpr = sql<number>`
    coalesce(sum((${payments.amountGbp})::numeric * 100), 0)::int
  `;
  const paymentCountExpr = sql<number>`count(${payments.id})::int`;

  const rows = await db
    .select({
      playerId: players.id,
      displayName: players.displayName,
      handle: players.handle,
      isActive: players.isActive,
      totalPaidPence: totalPaidPenceExpr.mapWith(Number),
      paymentCount: paymentCountExpr.mapWith(Number),
      lastPaidAt: sql<Date | null>`max(${payments.paidAt})`,
    })
    .from(players)
    .leftJoin(payments, eq(players.id, payments.playerId))
    .groupBy(players.id, players.displayName, players.handle, players.isActive)
    .orderBy(desc(totalPaidPenceExpr), players.displayName);

  const grandTotalPence = rows.reduce((sum, row) => sum + row.totalPaidPence, 0);
  const grandCount = rows.reduce((sum, row) => sum + row.paymentCount, 0);

  return (
    <div className="flex flex-col gap-8">
      <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <h2 className="text-lg font-semibold">Payment totals by player</h2>
        <p className="mt-2 text-sm text-white/60">
          All-time totals across every season.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.2em] text-white/50">
              Total paid
            </p>
            <p className="mt-1 text-xl font-semibold text-white">
              {formatGbp(grandTotalPence)}
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.2em] text-white/50">
              Payment count
            </p>
            <p className="mt-1 text-xl font-semibold text-white">{grandCount}</p>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-base font-semibold">Players</h3>
          <Link
            href="/admin/payments/new"
            className="rounded-xl border border-white/15 px-3 py-1 text-xs uppercase tracking-[0.16em] text-white/80 hover:border-white/35 hover:text-white"
          >
            Log payment
          </Link>
        </div>
        <div className="mt-4 flex flex-col gap-3">
          {rows.length ? (
            rows.map((row) => (
              <div
                key={row.playerId}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm"
              >
                <div className="flex flex-col">
                  <span className="font-semibold text-white">{row.displayName}</span>
                  <span className="text-xs text-white/60">
                    @{row.handle}
                    {row.isActive ? "" : " • inactive"}
                  </span>
                </div>
                <div className="text-right">
                  <p className="text-base font-semibold text-white">
                    {formatGbp(row.totalPaidPence)}
                  </p>
                  <p className="text-xs text-white/60">
                    {row.paymentCount} payments
                    {row.lastPaidAt
                      ? ` • last ${row.lastPaidAt.toISOString().slice(0, 10)}`
                      : ""}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <p className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white/60">
              No players found.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
