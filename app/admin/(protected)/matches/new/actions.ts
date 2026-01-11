"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { db } from "@/db";
import { appearances, matches } from "@/db/schema";

const parseNumber = (value: FormDataEntryValue | null, fallback = 0) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

export const createMatch = async (formData: FormData) => {
  const seasonId = Number(formData.get("seasonId"));
  const playedAtRaw = String(formData.get("playedAt") ?? "").trim();
  const opponent = String(formData.get("opponent") ?? "").trim();
  const venue = String(formData.get("venue") ?? "").trim();
  const goalsFor = parseNumber(formData.get("goalsFor"));
  const goalsAgainst = parseNumber(formData.get("goalsAgainst"));
  const matchCostRaw = String(formData.get("matchCostGbp") ?? "").trim();
  const matchCostGbp = matchCostRaw.length ? matchCostRaw : "70.00";

  if (!Number.isFinite(seasonId) || !playedAtRaw || !opponent) {
    redirect("/admin/matches/new?error=missing");
  }

  const playedAt = new Date(playedAtRaw);
  if (Number.isNaN(playedAt.getTime())) {
    redirect("/admin/matches/new?error=invalid_date");
  }

  const playerIds = formData
    .getAll("playerId")
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value));

  const [createdMatch] = await db
    .insert(matches)
    .values({
      seasonId,
      playedAt,
      opponent,
      venue: venue || null,
      goalsFor,
      goalsAgainst,
      matchCostGbp,
    })
    .returning({ id: matches.id });

  if (!createdMatch?.id) {
    redirect("/admin/matches/new?error=save_failed");
  }

  const appearanceRows = playerIds.map((playerId) => {
    const played = formData.get(`played-${playerId}`) === "on";
    const goals = parseNumber(formData.get(`goals-${playerId}`));
    const assists = parseNumber(formData.get(`assists-${playerId}`));

    return {
      matchId: createdMatch.id,
      playerId,
      played,
      goals: played ? goals : 0,
      assists: played ? assists : 0,
    };
  });

  if (appearanceRows.length) {
    await db.insert(appearances).values(appearanceRows);
  }

  revalidatePath("/admin/matches/new");
  revalidatePath("/");
  redirect("/admin/matches/new?success=1");
};
