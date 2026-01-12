import "server-only";

import { desc, eq, isNotNull } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import { externalLeagueSnapshots, seasons } from "@/db/schema";
import { refreshPlayFootballSnapshot } from "@/lib/playfootball";
import { getActiveSeason } from "@/lib/stats";

const getLondonParts = (date = new Date()) => {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  });
  const lookup = Object.fromEntries(
    formatter.formatToParts(date).map((part) => [part.type, part.value])
  );

  return {
    weekday: lookup.weekday,
    date: `${lookup.year}-${lookup.month}-${lookup.day}`,
    hour: Number(lookup.hour),
  };
};

const isAuthorized = (request: Request) => {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return false;
  }
  const header = request.headers.get("authorization");
  return header === `Bearer ${secret}`;
};

export const GET = async (request: Request) => {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const nowParts = getLondonParts(new Date());
  const summary: Record<string, unknown> = {
    time: nowParts,
    weekly: "skipped",
    final: "skipped",
    refreshed: [] as number[],
  };

  if (nowParts.weekday === "Tue" && nowParts.hour === 22) {
    const activeSeason = await getActiveSeason();
    if (activeSeason) {
      await refreshPlayFootballSnapshot(activeSeason);
      summary.weekly = "refreshed";
      (summary.refreshed as number[]).push(activeSeason.id);
    } else {
      summary.weekly = "no-active-season";
    }
  }

  if (nowParts.hour === 23) {
    const seasonRows = await db
      .select()
      .from(seasons)
      .where(isNotNull(seasons.endDate));

    const endingSeasons = seasonRows.filter(
      (season) => season.endDate && season.endDate === nowParts.date
    );

    if (endingSeasons.length === 0) {
      summary.final = "no-ending-season";
    } else {
      for (const season of endingSeasons) {
        const [latest] = await db
          .select({ fetchedAt: externalLeagueSnapshots.fetchedAt })
          .from(externalLeagueSnapshots)
          .where(eq(externalLeagueSnapshots.seasonId, season.id))
          .orderBy(desc(externalLeagueSnapshots.fetchedAt))
          .limit(1);

        if (latest) {
          const latestParts = getLondonParts(latest.fetchedAt);
          if (latestParts.date === nowParts.date && latestParts.hour >= 23) {
            continue;
          }
        }

        await refreshPlayFootballSnapshot(season);
        (summary.refreshed as number[]).push(season.id);
      }
      summary.final = "refreshed";
    }
  }

  return NextResponse.json(summary);
};
