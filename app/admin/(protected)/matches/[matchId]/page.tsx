import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { appearances, matches, players, seasons } from "@/db/schema";
import { formatDateTimeLocal } from "@/lib/playfootball";

import MatchForm from "../new/MatchForm";

export const dynamic = "force-dynamic";

type AdminEditMatchPageProps = {
  params: { matchId: string };
  searchParams?: { error?: string };
};

const ERROR_COPY: Record<string, string> = {
  missing: "Add match details before saving.",
  invalid_date: "Choose a valid date and time.",
  invalid_cost: "Enter a valid match cost.",
  no_players: "Add players before logging a match.",
  none_played: "Select at least one player as played.",
};

export default async function AdminEditMatchPage({
  params,
  searchParams,
}: AdminEditMatchPageProps) {
  const error = searchParams?.error
    ? ERROR_COPY[searchParams.error]
    : undefined;
  const matchId = Number(params.matchId);
  if (!Number.isFinite(matchId)) {
    notFound();
  }

  const [matchRow] = await db
    .select()
    .from(matches)
    .where(eq(matches.id, matchId))
    .limit(1);

  if (!matchRow) {
    notFound();
  }

  const [seasonRows, playerRows, appearanceRows] = await Promise.all([
    db
      .select()
      .from(seasons)
      .orderBy(desc(seasons.isActive), desc(seasons.startDate)),
    db.select().from(players).orderBy(players.displayName),
    db
      .select({
        playerId: appearances.playerId,
        played: appearances.played,
        goals: appearances.goals,
        assists: appearances.assists,
      })
      .from(appearances)
      .where(eq(appearances.matchId, matchId)),
  ]);

  const initialMatch = {
    seasonId: matchRow.seasonId,
    playedAt: formatDateTimeLocal(matchRow.playedAt.toISOString()),
    opponent: matchRow.opponent,
    venue: matchRow.venue,
    goalsFor: matchRow.goalsFor,
    goalsAgainst: matchRow.goalsAgainst,
    matchCostGbp: String(matchRow.matchCostGbp ?? "70.00"),
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-4 text-white">
        <div>
          <h2 className="text-lg font-semibold">Edit match</h2>
          <p className="text-sm text-white/60">
            Update the result or appearances for this fixture.
          </p>
        </div>
        <Link
          href="/admin/matches"
          className="text-xs uppercase tracking-wide text-white/60 hover:text-white"
        >
          Back to match log
        </Link>
      </div>
      {error ? (
        <div className="rounded-2xl border border-rose-400/40 bg-rose-500/10 px-4 py-3 text-xs uppercase tracking-wide text-rose-100">
          {error}
        </div>
      ) : null}
      <MatchForm
        action={`/admin/matches/${matchId}/submit`}
        players={playerRows}
        seasons={seasonRows}
        lastMatchPlayerIds={[]}
        initialMatch={initialMatch}
        initialAppearances={appearanceRows}
      />
    </div>
  );
}
