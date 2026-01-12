import { buildClearSessionCookie } from "@/lib/admin-auth";
import { redirectTo } from "@/lib/redirects";

export const GET = (request: Request) => {
  const response = redirectTo(request, "/admin/login");
  const cleared = buildClearSessionCookie();
  response.cookies.set(cleared.name, cleared.value, cleared.options);
  return response;
};
