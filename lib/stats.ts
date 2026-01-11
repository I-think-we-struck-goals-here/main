import "server-only";

import { desc, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { appearances, matches, payments, players, seasons } from "@/db/schema";
import { poundsToPence, splitMatchCost } from "@/lib/money";

export type PlayerStats = {
  playerId: number;
  displayName: string;
  handle: string;
  isActive: boolean;
  sortOrder: number;
  gamesPlayed: number;
  goals: number;
  assists: number;
  owedPence: number;
};

const buildStatsMap = async (seasonId?: number) => {
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
    })
    .from(appearances)
    .innerJoin(matches, eq(matches.id, appearances.matchId));

  const statsRows =
    seasonId !== undefined
      ? await statsQuery
          .where(eq(matches.seasonId, seasonId))
          .groupBy(appearances.playerId)
      : await statsQuery.groupBy(appearances.playerId);

  const statsMap = new Map<number, Omit<PlayerStats, "owedPence">>();
  for (const row of statsRows) {
    statsMap.set(row.playerId, {
      playerId: row.playerId,
      displayName: "",
      handle: "",
      isActive: false,
      sortOrder: 0,
      gamesPlayed: row.gamesPlayed ?? 0,
      goals: row.goals ?? 0,
      assists: row.assists ?? 0,
    });
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
          })
          .from(appearances)
          .innerJoin(matches, eq(matches.id, appearances.matchId))
          .innerJoin(players, eq(players.id, appearances.playerId));

  const appearancesByMatch = new Map<
    number,
    { costPence: number; players: { playerId: number; handle: string }[] }
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
    });
  }

  const owedMap = new Map<number, number>();
  for (const match of appearancesByMatch.values()) {
    const shares = splitMatchCost(match.costPence, match.players);
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

export const getSeasonLeaderboard = async (seasonId: number) => {
  const [playerRows, statsMap, owedMap] = await Promise.all([
    db
      .select()
      .from(players)
      .orderBy(players.sortOrder, players.displayName),
    buildStatsMap(seasonId),
    buildOwedMap(seasonId),
  ]);

  return playerRows.map((player) => {
    const stats = statsMap.get(player.id);
    return {
      playerId: player.id,
      displayName: player.displayName,
      handle: player.handle,
      isActive: player.isActive,
      sortOrder: player.sortOrder,
      gamesPlayed: stats?.gamesPlayed ?? 0,
      goals: stats?.goals ?? 0,
      assists: stats?.assists ?? 0,
      owedPence: owedMap.get(player.id) ?? 0,
    };
  });
};

export const getAllTimeLeaderboard = async () => {
  const [playerRows, statsMap, owedMap] = await Promise.all([
    db
      .select()
      .from(players)
      .orderBy(players.sortOrder, players.displayName),
    buildStatsMap(),
    buildOwedMap(),
  ]);

  return playerRows.map((player) => {
    const stats = statsMap.get(player.id);
    return {
      playerId: player.id,
      displayName: player.displayName,
      handle: player.handle,
      isActive: player.isActive,
      sortOrder: player.sortOrder,
      gamesPlayed: stats?.gamesPlayed ?? 0,
      goals: stats?.goals ?? 0,
      assists: stats?.assists ?? 0,
      owedPence: owedMap.get(player.id) ?? 0,
    };
  });
};

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
    stats: stats ?? {
      playerId: player.id,
      displayName: player.displayName,
      handle: player.handle,
      isActive: player.isActive,
      sortOrder: player.sortOrder,
      gamesPlayed: 0,
      goals: 0,
      assists: 0,
      owedPence,
    },
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
    stats: stats ?? {
      playerId: player.id,
      displayName: player.displayName,
      handle: player.handle,
      isActive: player.isActive,
      sortOrder: player.sortOrder,
      gamesPlayed: 0,
      goals: 0,
      assists: 0,
      owedPence: 0,
    },
  };
};
