import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { payments } from "@/db/schema";
import { requireAdminSession } from "@/lib/admin-auth";
import { redirectTo } from "@/lib/redirects";

export const POST = async (request: Request) => {
  if (!(await requireAdminSession())) {
    return redirectTo(request, "/admin/login");
  }

  const formData = await request.formData();
  const playerId = Number(formData.get("playerId"));
  const seasonId = Number(formData.get("seasonId"));
  const amountGbp = String(formData.get("amountGbp") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();
  const paidAtRaw = String(formData.get("paidAt") ?? "").trim();

  if (!Number.isFinite(playerId) || !Number.isFinite(seasonId) || !amountGbp) {
    return redirectTo(request, "/admin/payments/new?error=missing");
  }

  const parsedAmount = Number(amountGbp);
  if (!Number.isFinite(parsedAmount)) {
    return redirectTo(request, "/admin/payments/new?error=invalid_amount");
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
  return redirectTo(request, "/admin/payments/new?success=1");
};
