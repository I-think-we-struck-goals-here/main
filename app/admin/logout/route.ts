import { NextResponse } from "next/server";

import { buildClearSessionCookie } from "@/lib/admin-auth";

export const GET = (request: Request) => {
  const response = NextResponse.redirect("/admin/login", 303);
  const cleared = buildClearSessionCookie();
  response.cookies.set(cleared.name, cleared.value, cleared.options);
  return response;
};
