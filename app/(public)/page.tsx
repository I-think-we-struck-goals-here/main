import Link from "next/link";
import { eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { matches } from "@/db/schema";
import { formatSignedGbp } from "@/lib/money";
import { getActiveSeason, getSeasonLeaderboard } from "@/lib/stats";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const activeSeason = await getActiveSeason();

  if (!activeSeason) {
    return (
      <section className="rounded-[32px] border border-black/10 bg-white/80 p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">No season yet</h1>
        <p className="mt-2 text-sm text-black/60">
          Create a season in the admin area to start tracking stats.
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

  const [leaderboard, matchCountResult] = await Promise.all([
    getSeasonLeaderboard(activeSeason.id),
    db
      .select({
        count: sql<number>`count(*)`.mapWith(Number),
      })
      .from(matches)
      .where(eq(matches.seasonId, activeSeason.id)),
  ]);

  const matchCount = matchCountResult[0]?.count ?? 0;

  const topScorers = [...leaderboard]
    .sort((a, b) => b.goals - a.goals)
    .slice(0, 3);
  const topAssisters = [...leaderboard]
    .sort((a, b) => b.assists - a.assists)
    .slice(0, 3);
  const mostOwed = [...leaderboard]
    .sort((a, b) => b.owedPence - a.owedPence)
    .slice(0, 3);

  return (
    <div className="flex flex-col gap-8">
      <section className="grid gap-6 rounded-[36px] border border-black/10 bg-white/90 p-8 shadow-sm md:grid-cols-[1.2fr_0.8fr]">
        <div className="flex flex-col gap-4">
          <p className="text-xs uppercase tracking-[0.3em] text-black/40">
            {activeSeason.name}
          </p>
          <h1 className="text-4xl font-semibold leading-tight text-black">
            Goals, assists, and public balances in one place.
          </h1>
          <p className="text-sm text-black/60">
            {matchCount} matches logged this season. Leaderboards update the
            moment you log a game or payment.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href={`/season/${activeSeason.slug}`}
              className="rounded-full bg-black px-5 py-2 text-xs uppercase tracking-[0.2em] text-white"
            >
              Season leaderboard
            </Link>
            <Link
              href="/all-time"
              className="rounded-full border border-black/10 px-5 py-2 text-xs uppercase tracking-[0.2em] text-black/70"
            >
              All-time stats
            </Link>
          </div>
        </div>
        <div className="rounded-3xl border border-black/10 bg-black/5 p-6">
          <p className="text-xs uppercase tracking-[0.3em] text-black/40">
            Match cost
          </p>
          <p className="mt-4 text-4xl font-semibold text-black">£70.00</p>
          <p className="mt-2 text-sm text-black/60">
            Split evenly among everyone who played. Remainders are assigned by
            handle order to keep totals exact.
          </p>
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-3">
        <div className="rounded-[28px] border border-black/10 bg-white/80 p-6 shadow-sm">
          <p className="text-xs uppercase tracking-[0.3em] text-black/40">
            Top scorers
          </p>
          <div className="mt-4 flex flex-col gap-3">
            {topScorers.map((player) => (
              <div key={player.playerId} className="flex justify-between">
                <Link
                  href={`/player/${player.handle}`}
                  className="text-sm font-semibold text-black hover:underline"
                >
                  {player.displayName}
                </Link>
                <span className="text-sm text-black/70">{player.goals}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-[28px] border border-black/10 bg-white/80 p-6 shadow-sm">
          <p className="text-xs uppercase tracking-[0.3em] text-black/40">
            Top assisters
          </p>
          <div className="mt-4 flex flex-col gap-3">
            {topAssisters.map((player) => (
              <div key={player.playerId} className="flex justify-between">
                <Link
                  href={`/player/${player.handle}`}
                  className="text-sm font-semibold text-black hover:underline"
                >
                  {player.displayName}
                </Link>
                <span className="text-sm text-black/70">{player.assists}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-[28px] border border-black/10 bg-white/80 p-6 shadow-sm">
          <p className="text-xs uppercase tracking-[0.3em] text-black/40">
            Most owed
          </p>
          <div className="mt-4 flex flex-col gap-3">
            {mostOwed.map((player) => (
              <div key={player.playerId} className="flex justify-between">
                <Link
                  href={`/player/${player.handle}`}
                  className="text-sm font-semibold text-black hover:underline"
                >
                  {player.displayName}
                </Link>
                <span className="text-sm text-black/70">
                  {formatSignedGbp(player.owedPence)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
