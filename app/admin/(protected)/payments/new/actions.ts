"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { db } from "@/db";
import { payments, seasons } from "@/db/schema";

export const createPayment = async (formData: FormData) => {
  const playerId = Number.parseInt(String(formData.get("playerId") ?? ""), 10);
  const seasonId = Number.parseInt(String(formData.get("seasonId") ?? ""), 10);
  const amountGbp = String(formData.get("amountGbp") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();
  const paidAtRaw = String(formData.get("paidAt") ?? "").trim();

  if (!Number.isFinite(playerId) || playerId <= 0 || !Number.isFinite(seasonId) || seasonId <= 0 || !amountGbp) {
    redirect("/admin/payments/new?error=missing");
  }

  const parsedAmount = Number(amountGbp);
  if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
    redirect("/admin/payments/new?error=invalid_amount");
  }

  const [season] = await db
    .select({ id: seasons.id })
    .from(seasons)
    .where(eq(seasons.id, seasonId))
    .limit(1);
  if (!season) {
    redirect("/admin/payments/new?error=missing");
  }

  const paidAt = paidAtRaw ? new Date(paidAtRaw) : new Date();

  await db.insert(payments).values({
    playerId,
    seasonId,
    amountGbp,
    paidAt,
    note: note || null,
  });

  revalidatePath("/admin/payments/new");
  revalidatePath("/");
  redirect("/admin/payments/new?success=1");
};
