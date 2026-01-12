import { NextResponse } from "next/server";

import { buildClearSessionCookie } from "@/lib/admin-auth";

export const GET = (request: Request) => {
  const response = NextResponse.redirect(new URL("/admin/login", request.url));
  const cleared = buildClearSessionCookie();
  response.cookies.set(cleared.name, cleared.value, cleared.options);
  return response;
};
