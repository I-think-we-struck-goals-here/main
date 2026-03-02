import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { payments, seasons } from "@/db/schema";
import { requireAdminSession } from "@/lib/admin-auth";
import { redirectTo } from "@/lib/redirects";

export const POST = async (request: Request) => {
  if (!(await requireAdminSession())) {
    return redirectTo(request, "/admin/login");
  }

  const formData = await request.formData();
  const playerId = Number.parseInt(String(formData.get("playerId") ?? ""), 10);
  const seasonId = Number.parseInt(String(formData.get("seasonId") ?? ""), 10);
  const amountGbp = String(formData.get("amountGbp") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();

  if (!Number.isFinite(playerId) || playerId <= 0 || !Number.isFinite(seasonId) || seasonId <= 0 || !amountGbp) {
    return redirectTo(request, "/admin/payments/new?error=missing");
  }

  const parsedAmount = Number(amountGbp);
  if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
    return redirectTo(request, "/admin/payments/new?error=invalid_amount");
  }

  const [season] = await db
    .select({ id: seasons.id })
    .from(seasons)
    .where(eq(seasons.id, seasonId))
    .limit(1);
  if (!season) {
    return redirectTo(request, "/admin/payments/new?error=missing");
  }

  const paidAt = new Date();

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
