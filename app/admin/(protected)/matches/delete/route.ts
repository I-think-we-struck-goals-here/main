import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { matches } from "@/db/schema";
import { requireAdminSession } from "@/lib/admin-auth";
import { redirectTo } from "@/lib/redirects";

export const POST = async (request: Request) => {
  if (!(await requireAdminSession())) {
    return redirectTo(request, "/admin/login");
  }

  const formData = await request.formData();
  const matchId = Number(formData.get("matchId"));
  if (!Number.isFinite(matchId)) {
    return redirectTo(request, "/admin/matches?error=missing");
  }

  const deleted = await db
    .delete(matches)
    .where(eq(matches.id, matchId))
    .returning({ id: matches.id });

  if (!deleted.length) {
    return redirectTo(request, "/admin/matches?error=not_found");
  }

  revalidatePath("/admin/matches");
  revalidatePath("/");
  return redirectTo(request, "/admin/matches?deleted=1");
};
