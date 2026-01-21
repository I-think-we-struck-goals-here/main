import { eq } from "drizzle-orm";
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
  const paymentId = Number(formData.get("paymentId"));
  if (!Number.isFinite(paymentId)) {
    return redirectTo(request, "/admin/payments/new?error=missing");
  }

  const deleted = await db
    .delete(payments)
    .where(eq(payments.id, paymentId))
    .returning({ id: payments.id });

  if (!deleted.length) {
    return redirectTo(request, "/admin/payments/new?error=not_found");
  }

  revalidatePath("/admin/payments/new");
  revalidatePath("/money");
  revalidatePath("/");
  return redirectTo(request, "/admin/payments/new?deleted=1");
};
