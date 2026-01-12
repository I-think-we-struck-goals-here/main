import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { players } from "@/db/schema";
import { requireAdminSession } from "@/lib/admin-auth";

const slugifyName = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");

const toBool = (value: FormDataEntryValue | null) => value === "on";

const redirectTo = (path: string) => NextResponse.redirect(path, 303);

export const POST = async (request: Request) => {
  if (!(await requireAdminSession())) {
    return redirectTo("/admin/login");
  }

  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "create");

  if (intent === "update") {
    const id = Number(formData.get("playerId"));
    const displayName = String(formData.get("displayName") ?? "").trim();
    const handle = slugifyName(displayName);
    const isActive = toBool(formData.get("isActive"));

    if (!Number.isFinite(id) || !displayName || !handle) {
      return redirectTo("/admin/players?error=missing");
    }

    try {
      await db
        .update(players)
        .set({
          displayName,
          handle,
          isActive,
        })
        .where(eq(players.id, id));
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error) {
        if ((error as { code?: string }).code === "23505") {
          return redirectTo("/admin/players?error=duplicate");
        }
      }
      throw error;
    }
  } else {
    const displayName = String(formData.get("displayName") ?? "").trim();
    const handle = slugifyName(displayName);
    const isActive = toBool(formData.get("isActive"));

    if (!displayName || !handle) {
      return redirectTo("/admin/players?error=missing");
    }

    try {
      await db.insert(players).values({
        displayName,
        handle,
        isActive,
      });
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error) {
        if ((error as { code?: string }).code === "23505") {
          return redirectTo("/admin/players?error=duplicate");
        }
      }
      throw error;
    }
  }

  revalidatePath("/admin/players");
  revalidatePath("/");
  return redirectTo("/admin/players");
};
