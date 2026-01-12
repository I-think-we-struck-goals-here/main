import { and, desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { appearances, matches, players, seasons } from "@/db/schema";
import {
  formatDateTimeLocal,
  getNextFixtureForTeam,
  getPlayFootballSnapshot,
  isPlayFootballTeam,
} from "@/lib/playfootball";

import MatchForm from "./MatchForm";

export const dynamic = "force-dynamic";

type AdminNewMatchPageProps = {
  searchParams?: { error?: string; success?: string };
};

const ERROR_COPY: Record<string, string> = {
  missing: "Add match details before saving.",
  invalid_date: "Choose a valid date and time.",
  invalid_cost: "Enter a valid match cost.",
  no_players: "Add players before logging a match.",
  none_played: "Select at least one player as played.",
  save_failed: "Match save failed. Try again.",
};

export default async function AdminNewMatchPage({
  searchParams,
}: AdminNewMatchPageProps) {
  const error = searchParams?.error
    ? ERROR_COPY[searchParams.error]
    : undefined;
  const success = searchParams?.success ? "Match saved." : undefined;
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
    .orderBy(players.displayName);

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
  const playFootball = defaultSeason
    ? await getPlayFootballSnapshot(defaultSeason)
    : null;
  const nextFixture = playFootball
    ? getNextFixtureForTeam(playFootball.fixtures)
    : null;
  const defaultOpponent = nextFixture
    ? isPlayFootballTeam(nextFixture.home)
      ? nextFixture.away
      : nextFixture.home
    : undefined;
  const defaultPlayedAt =
    nextFixture?.kickoffAt ? formatDateTimeLocal(nextFixture.kickoffAt) : undefined;

  return (
    <div className="flex flex-col gap-4">
      {error ? (
        <div className="rounded-2xl border border-rose-400/40 bg-rose-500/10 px-4 py-3 text-xs uppercase tracking-wide text-rose-100">
          {error}
        </div>
      ) : null}
      {success ? (
        <div className="rounded-2xl border border-lime-300/40 bg-lime-400/10 px-4 py-3 text-xs uppercase tracking-wide text-lime-100">
          {success}
        </div>
      ) : null}
      <MatchForm
        action="/admin/matches/new/submit"
        players={playerRows}
        seasons={seasonRows}
        defaultSeasonId={defaultSeason?.id}
        lastMatchPlayerIds={lastMatchPlayerIds}
        defaultOpponent={defaultOpponent}
        defaultPlayedAt={defaultPlayedAt}
      />
    </div>
  );
}
