import { inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { appearances, matches, players } from "@/db/schema";
import { requireAdminSession } from "@/lib/admin-auth";
import { poundsToPence, splitMatchCost } from "@/lib/money";
import { redirectTo } from "@/lib/redirects";

const parseNumber = (value: FormDataEntryValue | null, fallback = 0) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

export const POST = async (
  request: Request,
  { params }: { params: Promise<{ matchId: string }> }
) => {
  const { matchId: matchIdParam } = await params;
  if (!(await requireAdminSession())) {
    return redirectTo(request, "/admin/login");
  }

  const matchId = Number(matchIdParam);
  if (!Number.isFinite(matchId)) {
    return redirectTo(request, "/admin/matches?error=missing");
  }

  const [existingMatch] = await db
    .select({ id: matches.id })
    .from(matches)
    .where(inArray(matches.id, [matchId]))
    .limit(1);

  if (!existingMatch) {
    return redirectTo(request, "/admin/matches?error=not_found");
  }

  const formData = await request.formData();
  const seasonId = Number(formData.get("seasonId"));
  const playedAtRaw = String(formData.get("playedAt") ?? "").trim();
  const opponent = String(formData.get("opponent") ?? "").trim();
  const venue = String(formData.get("venue") ?? "").trim();
  const goalsFor = parseNumber(formData.get("goalsFor"));
  const goalsAgainst = parseNumber(formData.get("goalsAgainst"));
  const matchCostRaw = String(formData.get("matchCostGbp") ?? "").trim();
  const matchCostGbp = matchCostRaw.length ? matchCostRaw : "70.95";

  if (!Number.isFinite(seasonId) || !playedAtRaw || !opponent) {
    return redirectTo(request, `/admin/matches/${matchId}?error=missing`);
  }

  const playedAt = new Date(playedAtRaw);
  if (Number.isNaN(playedAt.getTime())) {
    return redirectTo(request, `/admin/matches/${matchId}?error=invalid_date`);
  }

  const playerIds = formData
    .getAll("playerId")
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value));

  if (playerIds.length === 0) {
    return redirectTo(request, `/admin/matches/${matchId}?error=no_players`);
  }

  const playedPlayerIds = playerIds.filter(
    (playerId) => formData.get(`played-${playerId}`) === "on"
  );

  if (playedPlayerIds.length === 0) {
    return redirectTo(request, `/admin/matches/${matchId}?error=none_played`);
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
    return redirectTo(request, `/admin/matches/${matchId}?error=invalid_cost`);
  }

  const shareMap = new Map(
    splitMatchCost(matchCostPence, playedWithHandles).map((share) => [
      share.playerId,
      share.sharePence,
    ])
  );

  await db
    .update(matches)
    .set({
      seasonId,
      playedAt,
      opponent,
      venue: venue || null,
      goalsFor,
      goalsAgainst,
      matchCostGbp,
    })
    .where(inArray(matches.id, [matchId]));

  await db.delete(appearances).where(inArray(appearances.matchId, [matchId]));

  const playedSet = new Set(playedPlayerIds);
  const appearanceRows = playerIds.map((playerId) => {
    const played = playedSet.has(playerId);
    const goals = parseNumber(formData.get(`goals-${playerId}`));
    const assists = parseNumber(formData.get(`assists-${playerId}`));

    return {
      matchId,
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

  revalidatePath("/admin/matches");
  revalidatePath("/");
  revalidatePath("/league");
  return redirectTo(request, "/admin/matches?updated=1");
};
