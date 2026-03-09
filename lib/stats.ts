import "server-only";

import { desc, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { appearances, matches, payments, players, seasons } from "@/db/schema";
import { poundsToPence, splitMatchCost } from "@/lib/money";

type PlayerAggregateRaw = {
  playerId: number;
  gamesPlayed: number;
  goals: number;
  assists: number;
  teamGoalsFor: number;
  teamGoalsAgainst: number;
  wins: number;
  draws: number;
  losses: number;
  cleanSheets: number;
};

export type PlayerStats = {
  playerId: number;
  displayName: string;
  handle: string;
  isActive: boolean;
  gamesPlayed: number;
  goals: number;
  assists: number;
  goalContributions: number;
  goalsPerGame: number;
  assistsPerGame: number;
  goalContributionsPerGame: number;
  teamGoalsFor: number;
  teamGoalsAgainst: number;
  goalsForPerGame: number;
  goalsAgainstPerGame: number;
  goalDifference: number;
  goalDifferencePerGame: number;
  wins: number;
  draws: number;
  losses: number;
  winRate: number;
  drawRate: number;
  lossRate: number;
  cleanSheets: number;
  cleanSheetRate: number;
  pointsWon: number;
  pointsPerGame: number;
  contributionRate: number;
  owedPence: number;
};

export type PlayerBalance = {
  playerId: number;
  displayName: string;
  handle: string;
  isActive: boolean;
  owedPence: number;
};

const perGame = (value: number, gamesPlayed: number) =>
  gamesPlayed > 0 ? value / gamesPlayed : 0;

const rate = (value: number, total: number) => (total > 0 ? value / total : 0);

const toAggregate = (row?: Partial<PlayerAggregateRaw> | null): PlayerAggregateRaw => ({
  playerId: row?.playerId ?? 0,
  gamesPlayed: row?.gamesPlayed ?? 0,
  goals: row?.goals ?? 0,
  assists: row?.assists ?? 0,
  teamGoalsFor: row?.teamGoalsFor ?? 0,
  teamGoalsAgainst: row?.teamGoalsAgainst ?? 0,
  wins: row?.wins ?? 0,
  draws: row?.draws ?? 0,
  losses: row?.losses ?? 0,
  cleanSheets: row?.cleanSheets ?? 0,
});

const buildPlayerStats = ({
  player,
  aggregate,
  owedPence,
}: {
  player: {
    id: number;
    displayName: string;
    handle: string;
    isActive: boolean;
  };
  aggregate?: Partial<PlayerAggregateRaw> | null;
  owedPence: number;
}): PlayerStats => {
  const base = toAggregate(aggregate);
  const goalContributions = base.goals + base.assists;
  const goalDifference = base.teamGoalsFor - base.teamGoalsAgainst;
  const pointsWon = base.wins * 3 + base.draws;

  return {
    playerId: player.id,
    displayName: player.displayName,
    handle: player.handle,
    isActive: player.isActive,
    gamesPlayed: base.gamesPlayed,
    goals: base.goals,
    assists: base.assists,
    goalContributions,
    goalsPerGame: perGame(base.goals, base.gamesPlayed),
    assistsPerGame: perGame(base.assists, base.gamesPlayed),
    goalContributionsPerGame: perGame(goalContributions, base.gamesPlayed),
    teamGoalsFor: base.teamGoalsFor,
    teamGoalsAgainst: base.teamGoalsAgainst,
    goalsForPerGame: perGame(base.teamGoalsFor, base.gamesPlayed),
    goalsAgainstPerGame: perGame(base.teamGoalsAgainst, base.gamesPlayed),
    goalDifference,
    goalDifferencePerGame: perGame(goalDifference, base.gamesPlayed),
    wins: base.wins,
    draws: base.draws,
    losses: base.losses,
    winRate: rate(base.wins, base.gamesPlayed),
    drawRate: rate(base.draws, base.gamesPlayed),
    lossRate: rate(base.losses, base.gamesPlayed),
    cleanSheets: base.cleanSheets,
    cleanSheetRate: rate(base.cleanSheets, base.gamesPlayed),
    pointsWon,
    pointsPerGame: perGame(pointsWon, base.gamesPlayed),
    contributionRate: rate(goalContributions, base.teamGoalsFor),
    owedPence,
  };
};

const buildPerformanceMap = async (seasonId?: number) => {
  const statsQuery = db
    .select({
      playerId: appearances.playerId,
      gamesPlayed: sql<number>`
        sum(case when ${appearances.played} then 1 else 0 end)
      `.mapWith(Number),
      goals: sql<number>`
        sum(case when ${appearances.played} then ${appearances.goals} else 0 end)
      `.mapWith(Number),
      assists: sql<number>`
        sum(case when ${appearances.played} then ${appearances.assists} else 0 end)
      `.mapWith(Number),
      teamGoalsFor: sql<number>`
        sum(case when ${appearances.played} then ${matches.goalsFor} else 0 end)
      `.mapWith(Number),
      teamGoalsAgainst: sql<number>`
        sum(case when ${appearances.played} then ${matches.goalsAgainst} else 0 end)
      `.mapWith(Number),
      wins: sql<number>`
        sum(
          case
            when ${appearances.played} and ${matches.goalsFor} > ${matches.goalsAgainst}
            then 1
            else 0
          end
        )
      `.mapWith(Number),
      draws: sql<number>`
        sum(
          case
            when ${appearances.played} and ${matches.goalsFor} = ${matches.goalsAgainst}
            then 1
            else 0
          end
        )
      `.mapWith(Number),
      losses: sql<number>`
        sum(
          case
            when ${appearances.played} and ${matches.goalsFor} < ${matches.goalsAgainst}
            then 1
            else 0
          end
        )
      `.mapWith(Number),
      cleanSheets: sql<number>`
        sum(
          case
            when ${appearances.played} and ${matches.goalsAgainst} = 0
            then 1
            else 0
          end
        )
      `.mapWith(Number),
    })
    .from(appearances)
    .innerJoin(matches, eq(matches.id, appearances.matchId));

  const statsRows =
    seasonId !== undefined
      ? await statsQuery
          .where(eq(matches.seasonId, seasonId))
          .groupBy(appearances.playerId)
      : await statsQuery.groupBy(appearances.playerId);

  const statsMap = new Map<number, PlayerAggregateRaw>();
  for (const row of statsRows) {
    statsMap.set(row.playerId, toAggregate(row));
  }

  return statsMap;
};

const buildOwedMap = async (seasonId?: number) => {
  const matchRows =
    seasonId !== undefined
      ? await db
          .select({ id: matches.id, matchCostGbp: matches.matchCostGbp })
          .from(matches)
          .where(eq(matches.seasonId, seasonId))
      : await db
          .select({ id: matches.id, matchCostGbp: matches.matchCostGbp })
          .from(matches);

  if (matchRows.length === 0) {
    return new Map<number, number>();
  }

  const appearanceRows =
    seasonId !== undefined
      ? await db
          .select({
            matchId: appearances.matchId,
            playerId: appearances.playerId,
            played: appearances.played,
            handle: players.handle,
            matchSharePence: appearances.matchSharePence,
          })
          .from(appearances)
          .innerJoin(matches, eq(matches.id, appearances.matchId))
          .innerJoin(players, eq(players.id, appearances.playerId))
          .where(eq(matches.seasonId, seasonId))
      : await db
          .select({
            matchId: appearances.matchId,
            playerId: appearances.playerId,
            played: appearances.played,
            handle: players.handle,
            matchSharePence: appearances.matchSharePence,
          })
          .from(appearances)
          .innerJoin(matches, eq(matches.id, appearances.matchId))
          .innerJoin(players, eq(players.id, appearances.playerId));

  const appearancesByMatch = new Map<
    number,
    {
      costPence: number;
      players: { playerId: number; handle: string; sharePence: number | null }[];
    }
  >();

  for (const match of matchRows) {
    appearancesByMatch.set(match.id, {
      costPence: poundsToPence(match.matchCostGbp),
      players: [],
    });
  }

  for (const appearance of appearanceRows) {
    if (!appearance.played) {
      continue;
    }
    const entry = appearancesByMatch.get(appearance.matchId);
    if (!entry) {
      continue;
    }
    entry.players.push({
      playerId: appearance.playerId,
      handle: appearance.handle,
      sharePence: appearance.matchSharePence ?? null,
    });
  }

  const owedMap = new Map<number, number>();
  for (const match of appearancesByMatch.values()) {
    if (match.players.length === 0) {
      continue;
    }

    const allHaveShares = match.players.every(
      (player) => player.sharePence !== null
    );

    if (allHaveShares) {
      for (const player of match.players) {
        owedMap.set(
          player.playerId,
          (owedMap.get(player.playerId) ?? 0) + (player.sharePence ?? 0)
        );
      }
      continue;
    }

    const shares = splitMatchCost(
      match.costPence,
      match.players.map((player) => ({
        playerId: player.playerId,
        handle: player.handle,
      }))
    );
    for (const share of shares) {
      owedMap.set(
        share.playerId,
        (owedMap.get(share.playerId) ?? 0) + share.sharePence
      );
    }
  }

  const paymentRows =
    seasonId !== undefined
      ? await db
          .select({ playerId: payments.playerId, amountGbp: payments.amountGbp })
          .from(payments)
          .where(eq(payments.seasonId, seasonId))
      : await db
          .select({ playerId: payments.playerId, amountGbp: payments.amountGbp })
          .from(payments);

  for (const payment of paymentRows) {
    const paymentPence = poundsToPence(payment.amountGbp);
    owedMap.set(
      payment.playerId,
      (owedMap.get(payment.playerId) ?? 0) - paymentPence
    );
  }

  return owedMap;
};

const buildPlayerStatsRows = async (seasonId?: number) => {
  const [playerRows, performanceMap, owedMap] = await Promise.all([
    db.select().from(players).orderBy(players.displayName),
    buildPerformanceMap(seasonId),
    buildOwedMap(seasonId),
  ]);

  return playerRows.map((player) =>
    buildPlayerStats({
      player,
      aggregate: performanceMap.get(player.id),
      owedPence: owedMap.get(player.id) ?? 0,
    })
  );
};

export const getSeasons = async () =>
  db
    .select()
    .from(seasons)
    .orderBy(desc(seasons.isActive), desc(seasons.startDate));

export const getActiveSeason = async () => {
  const [active] = await db
    .select()
    .from(seasons)
    .where(eq(seasons.isActive, true))
    .limit(1);

  if (active) {
    return active;
  }

  const [latest] = await db
    .select()
    .from(seasons)
    .orderBy(desc(seasons.startDate), desc(seasons.id))
    .limit(1);

  return latest ?? null;
};

export const getSeasonBySlug = async (slug: string) => {
  const [season] = await db
    .select()
    .from(seasons)
    .where(eq(seasons.slug, slug))
    .limit(1);
  return season ?? null;
};

export const getSeasonLeaderboard = async (seasonId: number) =>
  buildPlayerStatsRows(seasonId);

export const getOutstandingBalances = async (): Promise<PlayerBalance[]> => {
  const [playerRows, owedMap] = await Promise.all([
    db
      .select()
      .from(players)
      .orderBy(players.displayName),
    buildOwedMap(),
  ]);

  return playerRows.map((player) => ({
    playerId: player.id,
    displayName: player.displayName,
    handle: player.handle,
    isActive: player.isActive,
    owedPence: owedMap.get(player.id) ?? 0,
  }));
};

export const getAllTimeLeaderboard = async () => buildPlayerStatsRows();

export const getPlayerAnalyticsRows = async (seasonId?: number) =>
  buildPlayerStatsRows(seasonId);

export const getPlayerSeasonStats = async (handle: string, seasonId: number) => {
  const [player] = await db
    .select()
    .from(players)
    .where(eq(players.handle, handle))
    .limit(1);

  if (!player) {
    return null;
  }

  const leaderboard = await getSeasonLeaderboard(seasonId);
  const stats = leaderboard.find((row) => row.playerId === player.id);
  const owedPence = stats?.owedPence ?? 0;

  return {
    player,
    stats:
      stats ??
      buildPlayerStats({
        player,
        owedPence,
      }),
    owedPence,
  };
};

export const getPlayerAllTimeStats = async (handle: string) => {
  const [player] = await db
    .select()
    .from(players)
    .where(eq(players.handle, handle))
    .limit(1);

  if (!player) {
    return null;
  }

  const leaderboard = await getAllTimeLeaderboard();
  const stats = leaderboard.find((row) => row.playerId === player.id);
  return {
    player,
    stats:
      stats ??
      buildPlayerStats({
        player,
        owedPence: 0,
      }),
  };
};
