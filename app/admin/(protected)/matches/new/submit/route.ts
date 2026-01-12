import { inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { appearances, matches, players } from "@/db/schema";
import { poundsToPence, splitMatchCost } from "@/lib/money";
import { requireAdminSession } from "@/lib/admin-auth";
import { redirectTo } from "@/lib/redirects";

const parseNumber = (value: FormDataEntryValue | null, fallback = 0) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

export const POST = async (request: Request) => {
  if (!(await requireAdminSession())) {
    return redirectTo(request, "/admin/login");
  }

  const formData = await request.formData();
  const seasonId = Number(formData.get("seasonId"));
  const playedAtRaw = String(formData.get("playedAt") ?? "").trim();
  const opponent = String(formData.get("opponent") ?? "").trim();
  const venue = String(formData.get("venue") ?? "").trim();
  const goalsFor = parseNumber(formData.get("goalsFor"));
  const goalsAgainst = parseNumber(formData.get("goalsAgainst"));
  const matchCostRaw = String(formData.get("matchCostGbp") ?? "").trim();
  const matchCostGbp = matchCostRaw.length ? matchCostRaw : "70.00";

  if (!Number.isFinite(seasonId) || !playedAtRaw || !opponent) {
    return redirectTo(request, "/admin/matches/new?error=missing");
  }

  const playedAt = new Date(playedAtRaw);
  if (Number.isNaN(playedAt.getTime())) {
    return redirectTo(request, "/admin/matches/new?error=invalid_date");
  }

  const playerIds = formData
    .getAll("playerId")
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value));

  if (playerIds.length === 0) {
    return redirectTo(request, "/admin/matches/new?error=no_players");
  }

  const playedPlayerIds = playerIds.filter(
    (playerId) => formData.get(`played-${playerId}`) === "on"
  );

  if (playedPlayerIds.length === 0) {
    return redirectTo(request, "/admin/matches/new?error=none_played");
  }

  const playerRows = await db
    .select({ id: players.id, handle: players.handle })
    .from(players)
    .where(inArray(players.id, playerIds));

  const handleById = new Map(playerRows.map((row) => [row.id, row.handle]));
  const playedWithHandles = playedPlayerIds.map((playerId) => ({
    playerId,
    handle: handleById.get(playerId) ?? String(playerId),
  }));

  const matchCostPence = poundsToPence(matchCostGbp);
  if (!Number.isFinite(matchCostPence)) {
    return redirectTo(request, "/admin/matches/new?error=invalid_cost");
  }

  const shareMap = new Map(
    splitMatchCost(matchCostPence, playedWithHandles).map((share) => [
      share.playerId,
      share.sharePence,
    ])
  );

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
    return redirectTo(request, "/admin/matches/new?error=save_failed");
  }

  const playedSet = new Set(playedPlayerIds);
  const appearanceRows = playerIds.map((playerId) => {
    const played = playedSet.has(playerId);
    const goals = parseNumber(formData.get(`goals-${playerId}`));
    const assists = parseNumber(formData.get(`assists-${playerId}`));

    return {
      matchId: createdMatch.id,
      playerId,
      played,
      goals: played ? goals : 0,
      assists: played ? assists : 0,
      matchSharePence: played ? shareMap.get(playerId) ?? null : null,
    };
  });

  if (appearanceRows.length) {
    await db.insert(appearances).values(appearanceRows);
  }

  revalidatePath("/admin/matches/new");
  revalidatePath("/");
  return redirectTo(request, "/admin/matches/new?success=1");
};
