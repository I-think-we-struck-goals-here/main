import { desc, eq, isNotNull } from "drizzle-orm";

import { db } from "../../db";
import { externalLeagueSnapshots, seasons } from "../../db/schema";
import { refreshPlayFootballSnapshot } from "../../lib/playfootball";

const getLondonDateParts = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const lookup = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    weekday: lookup.weekday,
    date: `${lookup.year}-${lookup.month}-${lookup.day}`,
    hour: Number(lookup.hour),
  };
};

export const config = {
  schedule: "0 22,23 * * *",
};

export const handler = async () => {
  const now = new Date();
  const { date, hour } = getLondonDateParts(now);

  if (hour !== 23) {
    return {
      statusCode: 200,
      body: "Skipped (outside final snapshot window).",
    };
  }

  const seasonRows = await db
    .select()
    .from(seasons)
    .where(isNotNull(seasons.endDate));

  const endingSeasons = seasonRows.filter(
    (season) => season.endDate && season.endDate === date
  );

  if (endingSeasons.length === 0) {
    return {
      statusCode: 200,
      body: "No seasons ending today.",
    };
  }

  for (const season of endingSeasons) {
    const [latest] = await db
      .select({ fetchedAt: externalLeagueSnapshots.fetchedAt })
      .from(externalLeagueSnapshots)
      .where(eq(externalLeagueSnapshots.seasonId, season.id))
      .orderBy(desc(externalLeagueSnapshots.fetchedAt))
      .limit(1);

    if (latest) {
      const latestParts = getLondonDateParts(latest.fetchedAt);
      if (latestParts.date === date && latestParts.hour >= 23) {
        continue;
      }
    }

    await refreshPlayFootballSnapshot(season);
  }

  return {
    statusCode: 200,
    body: "Final snapshots refreshed.",
  };
};
