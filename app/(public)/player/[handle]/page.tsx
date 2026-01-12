import Link from "next/link";
import { notFound } from "next/navigation";

import { buildMonzoLink, formatSignedGbp } from "@/lib/money";
import {
  getActiveSeason,
  getPlayerAllTimeStats,
  getPlayerSeasonStats,
} from "@/lib/stats";

export const dynamic = "force-dynamic";

type PlayerPageProps = {
  params: { handle: string };
};

export default async function PlayerPage({ params }: PlayerPageProps) {
  const activeSeason = await getActiveSeason();
  const [seasonStats, allTimeStats] = await Promise.all([
    activeSeason
      ? getPlayerSeasonStats(params.handle, activeSeason.id)
      : Promise.resolve(null),
    getPlayerAllTimeStats(params.handle),
  ]);

  if (!allTimeStats) {
    notFound();
  }

  const currentOwedPence = seasonStats?.owedPence ?? 0;
  const showPayButton = currentOwedPence > 0;
  const showCredit = currentOwedPence < 0;

  return (
    <div className="flex flex-col gap-8">
      <section className="rounded-[32px] border border-black/10 bg-white/90 p-8 shadow-sm">
        <p className="text-xs uppercase tracking-[0.3em] text-black/40">
          Player profile
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-black">
          {allTimeStats.player.displayName}
        </h1>
        <div className="mt-6 grid gap-6 md:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-3xl border border-black/10 bg-black/5 p-6">
            <p className="text-xs uppercase tracking-[0.3em] text-black/40">
              Current owed
            </p>
            <p className="mt-3 text-4xl font-semibold text-black">
              {formatSignedGbp(currentOwedPence)}
            </p>
            {showPayButton ? (
              <a
                href={buildMonzoLink(currentOwedPence)}
                className="mt-4 inline-flex rounded-full bg-black px-5 py-2 text-xs uppercase tracking-[0.2em] text-white"
                target="_blank"
                rel="noopener noreferrer"
              >
                Settle up
              </a>
            ) : showCredit ? (
              <span className="mt-4 inline-flex rounded-full border border-black/10 px-4 py-2 text-xs uppercase tracking-[0.2em] text-black/60">
                Credit balance
              </span>
            ) : (
              <span className="mt-4 inline-flex rounded-full border border-black/10 px-4 py-2 text-xs uppercase tracking-[0.2em] text-black/60">
                All square
              </span>
            )}
          </div>
          <div className="flex flex-col gap-3 text-sm text-black/60">
            <p>
              Season stats shown for{" "}
              <span className="font-semibold text-black">
                {activeSeason?.name ?? "current season"}
              </span>
              .
            </p>
            <Link
              href="/all-time"
              className="text-xs uppercase tracking-[0.2em] text-black/60 hover:text-black"
            >
              View all-time leaderboard
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <div className="rounded-[28px] border border-black/10 bg-white/80 p-6 shadow-sm">
          <p className="text-xs uppercase tracking-[0.3em] text-black/40">
            Season stats
          </p>
          <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-black/40">
                Games
              </p>
              <p className="text-2xl font-semibold text-black">
                {seasonStats?.stats.gamesPlayed ?? 0}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-black/40">
                Goals
              </p>
              <p className="text-2xl font-semibold text-black">
                {seasonStats?.stats.goals ?? 0}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-black/40">
                Assists
              </p>
              <p className="text-2xl font-semibold text-black">
                {seasonStats?.stats.assists ?? 0}
              </p>
            </div>
          </div>
        </div>
        <div className="rounded-[28px] border border-black/10 bg-white/80 p-6 shadow-sm">
          <p className="text-xs uppercase tracking-[0.3em] text-black/40">
            All-time stats
          </p>
          <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-black/40">
                Games
              </p>
              <p className="text-2xl font-semibold text-black">
                {allTimeStats.stats.gamesPlayed}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-black/40">
                Goals
              </p>
              <p className="text-2xl font-semibold text-black">
                {allTimeStats.stats.goals}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-black/40">
                Assists
              </p>
              <p className="text-2xl font-semibold text-black">
                {allTimeStats.stats.assists}
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
