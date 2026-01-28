"use server";

import { redirect } from "next/navigation";

import { attemptAdminLogin } from "@/lib/admin-auth";

export const loginAction = async (formData: FormData) => {
  const password = formData.get("password");
  if (typeof password !== "string" || password.trim().length === 0) {
    redirect("/admin/login?error=missing");
  }

  const result = await attemptAdminLogin(password);
  if (!result.ok) {
    redirect(`/admin/login?error=${result.reason}`);
  }

  redirect("/admin/players");
};
