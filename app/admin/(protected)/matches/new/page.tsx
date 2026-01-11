import { and, desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { appearances, matches, players, seasons } from "@/db/schema";

import { createMatch } from "./actions";
import MatchForm from "./MatchForm";

export const dynamic = "force-dynamic";

export default async function AdminNewMatchPage() {
  const seasonRows = await db
    .select()
    .from(seasons)
    .orderBy(desc(seasons.isActive), desc(seasons.startDate));

  if (seasonRows.length === 0) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-white">
        <h2 className="text-lg font-semibold">Add a season first</h2>
        <p className="text-sm text-white/60">
          Create a season before logging matches.
        </p>
      </div>
    );
  }

  const playerRows = await db
    .select()
    .from(players)
    .where(eq(players.isActive, true))
    .orderBy(players.sortOrder, players.displayName);

  if (playerRows.length === 0) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-white">
        <h2 className="text-lg font-semibold">Add players first</h2>
        <p className="text-sm text-white/60">
          You need an active roster before logging a match.
        </p>
      </div>
    );
  }

  const [lastMatch] = await db
    .select({ id: matches.id })
    .from(matches)
    .orderBy(desc(matches.playedAt))
    .limit(1);

  let lastMatchPlayerIds: number[] = [];
  if (lastMatch?.id) {
    const lastRows = await db
      .select({ playerId: appearances.playerId })
      .from(appearances)
      .where(and(eq(appearances.matchId, lastMatch.id), eq(appearances.played, true)));
    lastMatchPlayerIds = lastRows.map((row) => row.playerId);
  }

  const defaultSeason = seasonRows.find((season) => season.isActive) ?? seasonRows[0];

  return (
    <MatchForm
      action={createMatch}
      players={playerRows}
      seasons={seasonRows}
      defaultSeasonId={defaultSeason?.id}
      lastMatchPlayerIds={lastMatchPlayerIds}
    />
  );
}
