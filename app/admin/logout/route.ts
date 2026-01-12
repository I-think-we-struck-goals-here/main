import { NextResponse } from "next/server";

import { clearAdminSession } from "@/lib/admin-auth";

export const GET = async (request: Request) => {
  await clearAdminSession();
  return NextResponse.redirect(new URL("/admin/login", request.url));
};
