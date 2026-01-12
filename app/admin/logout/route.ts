import { buildClearSessionCookie } from "@/lib/admin-auth";
import { redirectTo } from "@/lib/redirects";

const handleLogout = (request: Request) => {
  const response = redirectTo(request, "/admin/login");
  const cleared = buildClearSessionCookie();
  response.cookies.set(cleared.name, cleared.value, cleared.options);
  return response;
};

export const POST = (request: Request) => handleLogout(request);

export const GET = (request: Request) => handleLogout(request);
