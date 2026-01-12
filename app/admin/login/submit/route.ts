import { NextResponse } from "next/server";

import { attemptAdminLogin } from "@/lib/admin-auth";

export const POST = async (request: Request) => {
  const formData = await request.formData();
  const rawPassword = formData.get("password");
  const password = typeof rawPassword === "string" ? rawPassword.trim() : "";

  if (!password) {
    return NextResponse.redirect("/admin/login?error=missing", 303);
  }

  const result = await attemptAdminLogin(password);
  if (!result.ok) {
    return NextResponse.redirect(`/admin/login?error=${result.reason}`, 303);
  }

  const response = NextResponse.redirect("/admin/players", 303);
  response.cookies.set(result.cookie.name, result.cookie.value, result.cookie.options);
  return response;
};
