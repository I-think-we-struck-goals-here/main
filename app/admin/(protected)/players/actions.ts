"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { eq } from "drizzle-orm";

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

const ensureAdmin = async () => {
  if (!(await requireAdminSession())) {
    redirect("/admin/login");
  }
};

export const createPlayer = async (formData: FormData) => {
  await ensureAdmin();
  const displayName = String(formData.get("displayName") ?? "").trim();
  const handle = slugifyName(displayName);
  const isActive = toBool(formData.get("isActive"));

  if (!displayName || !handle) {
    redirect("/admin/players?error=missing");
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
        redirect("/admin/players?error=duplicate");
      }
    }
    throw error;
  }

  revalidatePath("/admin/players");
  revalidatePath("/");
  redirect("/admin/players");
};

export const updatePlayer = async (formData: FormData) => {
  await ensureAdmin();
  const id = Number(formData.get("playerId"));
  const displayName = String(formData.get("displayName") ?? "").trim();
  const handle = slugifyName(displayName);
  const isActive = toBool(formData.get("isActive"));

  if (!Number.isFinite(id) || !displayName || !handle) {
    redirect("/admin/players?error=missing");
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
        redirect("/admin/players?error=duplicate");
      }
    }
    throw error;
  }

  revalidatePath("/admin/players");
  revalidatePath("/");
  redirect("/admin/players");
};
