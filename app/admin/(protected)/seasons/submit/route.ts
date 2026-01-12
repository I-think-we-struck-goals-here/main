import { NextResponse } from "next/server";
import { eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";

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

const redirectTo = (request: Request, path: string) =>
  NextResponse.redirect(new URL(path, request.url), 303);

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

  const name = String(formData.get("name") ?? "").trim();
  const slug = normalizeSlug(String(formData.get("slug") ?? ""));
  const startDate = parseDate(formData.get("startDate"));
  const endDate = parseDate(formData.get("endDate"));
  const isActive = formData.get("isActive") === "on";

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
