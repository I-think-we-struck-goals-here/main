import { eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { seasons } from "@/db/schema";
import { requireAdminSession } from "@/lib/admin-auth";
import { refreshPlayFootballSnapshot } from "@/lib/playfootball";
import { redirectTo } from "@/lib/redirects";

const normalizeSlug = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");

const parseDate = (value: FormDataEntryValue | null) => {
  if (!value) {
    return null;
  }
  const text = String(value).trim();
  return text.length ? text : null;
};

const parseText = (value: FormDataEntryValue | null) => {
  const text = String(value ?? "").trim();
  return text.length ? text : null;
};

export const POST = async (request: Request) => {
  if (!(await requireAdminSession())) {
    return redirectTo(request, "/admin/login");
  }

  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "create");

  if (intent === "activate") {
    const seasonId = Number(formData.get("seasonId"));
    if (!Number.isFinite(seasonId)) {
      return redirectTo(request, "/admin/seasons?error=missing");
    }

    await db.transaction(async (tx) => {
      await tx.update(seasons).set({ isActive: false });
      await tx.update(seasons).set({ isActive: true }).where(eq(seasons.id, seasonId));
    });

    revalidatePath("/admin/seasons");
    revalidatePath("/");
    return redirectTo(request, "/admin/seasons");
  }

  if (intent === "update_playfootball") {
    const seasonId = Number(formData.get("seasonId"));
    if (!Number.isFinite(seasonId)) {
      return redirectTo(request, "/admin/seasons?error=missing");
    }

    const sourceUrlFixtures = parseText(formData.get("sourceUrlFixtures"));
    const sourceUrlStandings = parseText(formData.get("sourceUrlStandings"));
    const playfootballTeamName = parseText(formData.get("playfootballTeamName"));

    await db
      .update(seasons)
      .set({
        sourceUrlFixtures,
        sourceUrlStandings,
        playfootballTeamName,
      })
      .where(eq(seasons.id, seasonId));

    revalidatePath("/admin/seasons");
    revalidatePath("/");
    revalidatePath("/league");
    revalidatePath("/admin/matches/new");
    return redirectTo(request, "/admin/seasons?sync=updated");
  }

  if (intent === "update_details") {
    const seasonId = Number(formData.get("seasonId"));
    if (!Number.isFinite(seasonId)) {
      return redirectTo(request, "/admin/seasons?error=missing");
    }

    const name = String(formData.get("name") ?? "").trim();
    const startDate = parseDate(formData.get("startDate"));
    const endDate = parseDate(formData.get("endDate"));

    if (!name) {
      return redirectTo(request, "/admin/seasons?error=missing");
    }

    await db
      .update(seasons)
      .set({
        name,
        startDate,
        endDate,
      })
      .where(eq(seasons.id, seasonId));

    revalidatePath("/admin/seasons");
    revalidatePath("/");
    revalidatePath("/league");
    return redirectTo(request, "/admin/seasons?updated=details");
  }

  if (intent === "refresh_playfootball") {
    const seasonId = Number(formData.get("seasonId"));
    if (!Number.isFinite(seasonId)) {
      return redirectTo(request, "/admin/seasons?error=missing");
    }

    const [season] = await db
      .select()
      .from(seasons)
      .where(eq(seasons.id, seasonId))
      .limit(1);

    if (!season) {
      return redirectTo(request, "/admin/seasons?error=missing");
    }

    await refreshPlayFootballSnapshot(season);

    revalidatePath("/admin/seasons");
    revalidatePath("/");
    revalidatePath("/league");
    revalidatePath("/admin/matches/new");
    return redirectTo(request, "/admin/seasons?sync=refreshed");
  }

  const name = String(formData.get("name") ?? "").trim();
  const slug = normalizeSlug(String(formData.get("slug") ?? ""));
  const startDate = parseDate(formData.get("startDate"));
  const endDate = parseDate(formData.get("endDate"));
  const isActive = formData.get("isActive") === "on";
  const sourceUrlFixtures = parseText(formData.get("sourceUrlFixtures"));
  const sourceUrlStandings = parseText(formData.get("sourceUrlStandings"));
  const playfootballTeamName = parseText(formData.get("playfootballTeamName"));

  if (!name || !slug) {
    return redirectTo(request, "/admin/seasons?error=missing");
  }

  let created: { id: number } | undefined;
  try {
    [created] = await db
      .insert(seasons)
      .values({
        name,
        slug,
        startDate,
        endDate,
        isActive,
        sourceUrlFixtures,
        sourceUrlStandings,
        playfootballTeamName,
      })
      .returning({ id: seasons.id });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error) {
      if ((error as { code?: string }).code === "23505") {
        return redirectTo(request, "/admin/seasons?error=duplicate");
      }
    }
    throw error;
  }

  if (isActive && created?.id) {
    await db
      .update(seasons)
      .set({ isActive: false })
      .where(ne(seasons.id, created.id));
  }

  revalidatePath("/admin/seasons");
  revalidatePath("/");
  return redirectTo(request, "/admin/seasons");
};
