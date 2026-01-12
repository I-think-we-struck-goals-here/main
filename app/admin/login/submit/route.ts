import { attemptAdminLogin } from "@/lib/admin-auth";
import { redirectTo } from "@/lib/redirects";

export const POST = async (request: Request) => {
  const formData = await request.formData();
  const rawPassword = formData.get("password");
  const password = typeof rawPassword === "string" ? rawPassword.trim() : "";

  if (!password) {
    return redirectTo(request, "/admin/login?error=missing");
  }

  const result = await attemptAdminLogin(password);
  if (!result.ok) {
    return redirectTo(request, `/admin/login?error=${result.reason}`);
  }

  const response = redirectTo(request, "/admin/players");
  response.cookies.set(result.cookie.name, result.cookie.value, result.cookie.options);
  return response;
};
