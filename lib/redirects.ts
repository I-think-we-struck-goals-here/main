import "server-only";

import { NextResponse } from "next/server";

const getBaseUrl = (request: Request) => {
  const envBase = process.env.DEPLOY_PRIME_URL || process.env.URL;
  if (envBase) {
    return envBase;
  }

  const proto = request.headers.get("x-forwarded-proto") ?? "https";
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (host) {
    return `${proto}://${host}`;
  }

  return request.url;
};

export const redirectTo = (request: Request, path: string, status = 303) => {
  return NextResponse.redirect(new URL(path, getBaseUrl(request)), status);
};
