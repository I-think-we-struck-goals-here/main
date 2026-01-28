"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { db } from "@/db";
import { payments } from "@/db/schema";

export const createPayment = async (formData: FormData) => {
  const playerId = Number(formData.get("playerId"));
  const seasonId = Number(formData.get("seasonId"));
  const amountGbp = String(formData.get("amountGbp") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();
  const paidAtRaw = String(formData.get("paidAt") ?? "").trim();

  if (!Number.isFinite(playerId) || !Number.isFinite(seasonId) || !amountGbp) {
    redirect("/admin/payments/new?error=missing");
  }

  const parsedAmount = Number(amountGbp);
  if (!Number.isFinite(parsedAmount)) {
    redirect("/admin/payments/new?error=invalid_amount");
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
