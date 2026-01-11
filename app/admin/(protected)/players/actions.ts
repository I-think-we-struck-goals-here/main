"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { players } from "@/db/schema";

const normalizeHandle = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");

const toBool = (value: FormDataEntryValue | null) => value === "on";

export const createPlayer = async (formData: FormData) => {
  const displayName = String(formData.get("displayName") ?? "").trim();
  const handle = normalizeHandle(String(formData.get("handle") ?? ""));
  const sortOrder = Number(formData.get("sortOrder") ?? 0);
  const isActive = toBool(formData.get("isActive"));

  if (!displayName || !handle) {
    redirect("/admin/players?error=missing");
  }

  await db.insert(players).values({
    displayName,
    handle,
    sortOrder: Number.isFinite(sortOrder) ? sortOrder : 0,
    isActive,
  });

  revalidatePath("/admin/players");
  revalidatePath("/");
  redirect("/admin/players");
};

export const updatePlayer = async (formData: FormData) => {
  const id = Number(formData.get("playerId"));
  const displayName = String(formData.get("displayName") ?? "").trim();
  const handle = normalizeHandle(String(formData.get("handle") ?? ""));
  const sortOrder = Number(formData.get("sortOrder") ?? 0);
  const isActive = toBool(formData.get("isActive"));

  if (!Number.isFinite(id) || !displayName || !handle) {
    redirect("/admin/players?error=missing");
  }

  await db
    .update(players)
    .set({
      displayName,
      handle,
      sortOrder: Number.isFinite(sortOrder) ? sortOrder : 0,
      isActive,
    })
    .where(eq(players.id, id));

  revalidatePath("/admin/players");
  revalidatePath("/");
  redirect("/admin/players");
};
