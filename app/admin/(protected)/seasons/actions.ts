"use server";

import { eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { db } from "@/db";
import { seasons } from "@/db/schema";
import { requireAdminSession } from "@/lib/admin-auth";

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

const ensureAdmin = async () => {
  if (!(await requireAdminSession())) {
    redirect("/admin/login");
  }
};

export const createSeason = async (formData: FormData) => {
  await ensureAdmin();
  const name = String(formData.get("name") ?? "").trim();
  const slug = normalizeSlug(String(formData.get("slug") ?? ""));
  const startDate = parseDate(formData.get("startDate"));
  const endDate = parseDate(formData.get("endDate"));
  const isActive = formData.get("isActive") === "on";

  if (!name || !slug) {
    redirect("/admin/seasons?error=missing");
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
      })
      .returning({ id: seasons.id });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error) {
      if ((error as { code?: string }).code === "23505") {
        redirect("/admin/seasons?error=duplicate");
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
  redirect("/admin/seasons");
};

export const setActiveSeason = async (formData: FormData) => {
  await ensureAdmin();
  const seasonId = Number(formData.get("seasonId"));
  if (!Number.isFinite(seasonId)) {
    redirect("/admin/seasons?error=missing");
  }

  await db.transaction(async (tx) => {
    await tx.update(seasons).set({ isActive: false });
    await tx.update(seasons).set({ isActive: true }).where(eq(seasons.id, seasonId));
  });

  revalidatePath("/admin/seasons");
  revalidatePath("/");
  redirect("/admin/seasons");
};
