import { desc, eq } from "drizzle-orm";

import { db } from "../../db";
import { externalLeagueSnapshots } from "../../db/schema";
import { refreshPlayFootballSnapshot } from "../../lib/playfootball";
import { getActiveSeason } from "../../lib/stats";

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
  schedule: "0 21,22 * * 2",
};

export const handler = async () => {
  const now = new Date();
  const { weekday, date, hour } = getLondonDateParts(now);

  if (weekday !== "Tue" || hour !== 22) {
    return {
      statusCode: 200,
      body: "Skipped (outside scheduled window).",
    };
  }

  const activeSeason = await getActiveSeason();
  if (!activeSeason) {
    return {
      statusCode: 200,
      body: "No active season.",
    };
  }

  const [latest] = await db
    .select({ fetchedAt: externalLeagueSnapshots.fetchedAt })
    .from(externalLeagueSnapshots)
    .where(eq(externalLeagueSnapshots.seasonId, activeSeason.id))
    .orderBy(desc(externalLeagueSnapshots.fetchedAt))
    .limit(1);

  if (latest) {
    const latestDate = getLondonDateParts(latest.fetchedAt).date;
    if (latestDate === date) {
      return {
        statusCode: 200,
        body: "Snapshot already refreshed today.",
      };
    }
  }

  await refreshPlayFootballSnapshot(activeSeason);

  return {
    statusCode: 200,
    body: "Weekly snapshot refreshed.",
  };
};
