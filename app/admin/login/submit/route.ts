import { NextResponse } from "next/server";

import { attemptAdminLogin } from "@/lib/admin-auth";

export const POST = async (request: Request) => {
  const formData = await request.formData();
  const rawPassword = formData.get("password");
  const password = typeof rawPassword === "string" ? rawPassword.trim() : "";

  if (!password) {
    return NextResponse.redirect(
      new URL("/admin/login?error=missing", request.url),
      303
    );
  }

  const result = await attemptAdminLogin(password);
  if (!result.ok) {
    return NextResponse.redirect(
      new URL(`/admin/login?error=${result.reason}`, request.url),
      303
    );
  }

  const response = NextResponse.redirect(
    new URL("/admin/players", request.url),
    303
  );
  response.cookies.set(result.cookie.name, result.cookie.value, result.cookie.options);
  return response;
};
