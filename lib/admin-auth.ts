import "server-only";

import crypto from "crypto";
import { cookies, headers } from "next/headers";

import { verifyPassword } from "./password";

const SESSION_COOKIE = "admin_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 7;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_MAX_ATTEMPTS = 5;

const loginAttempts = new Map<string, { count: number; firstAttemptMs: number }>();

const getClientIp = async () => {
  const headerStore = await headers();
  const forwarded = headerStore.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() ?? "unknown";
  }
  return headerStore.get("x-real-ip") ?? "unknown";
};

const getSessionSecret = () => {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) {
    throw new Error("ADMIN_SESSION_SECRET is not set");
  }
  return secret;
};

const signSession = (issuedAt: number) => {
  return crypto
    .createHmac("sha256", getSessionSecret())
    .update(String(issuedAt))
    .digest("hex");
};

const verifySessionValue = (value: string) => {
  const [issuedAtRaw, signature] = value.split(".");
  if (!issuedAtRaw || !signature) {
    return false;
  }

  const issuedAt = Number(issuedAtRaw);
  if (!Number.isFinite(issuedAt)) {
    return false;
  }

  const expected = signSession(issuedAt);
  const signatureBuffer = Buffer.from(signature, "hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  if (signatureBuffer.length !== expectedBuffer.length) {
    return false;
  }

  const isValid = crypto.timingSafeEqual(signatureBuffer, expectedBuffer);
  if (!isValid) {
    return false;
  }

  const ageSeconds = Math.floor(Date.now() / 1000) - issuedAt;
  return ageSeconds >= 0 && ageSeconds <= SESSION_MAX_AGE;
};

const recordFailedAttempt = (ip: string) => {
  const now = Date.now();
  const existing = loginAttempts.get(ip);
  if (!existing || now - existing.firstAttemptMs > RATE_LIMIT_WINDOW_MS) {
    loginAttempts.set(ip, { count: 1, firstAttemptMs: now });
    return;
  }

  loginAttempts.set(ip, {
    count: existing.count + 1,
    firstAttemptMs: existing.firstAttemptMs,
  });
};

const clearAttempts = (ip: string) => {
  loginAttempts.delete(ip);
};

const isRateLimited = (ip: string) => {
  const existing = loginAttempts.get(ip);
  if (!existing) {
    return false;
  }

  if (Date.now() - existing.firstAttemptMs > RATE_LIMIT_WINDOW_MS) {
    loginAttempts.delete(ip);
    return false;
  }

  return existing.count >= RATE_LIMIT_MAX_ATTEMPTS;
};

export const attemptAdminLogin = async (password: string) => {
  const ip = await getClientIp();
  if (isRateLimited(ip)) {
    return { ok: false, reason: "rate_limited" as const };
  }

  const storedHash = process.env.ADMIN_PASSWORD_HASH;
  if (!storedHash) {
    throw new Error("ADMIN_PASSWORD_HASH is not set");
  }

  const isValid = verifyPassword(password, storedHash);
  if (!isValid) {
    recordFailedAttempt(ip);
    return { ok: false, reason: "invalid" as const };
  }

  clearAttempts(ip);
  const issuedAt = Math.floor(Date.now() / 1000);
  const value = `${issuedAt}.${signSession(issuedAt)}`;
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_MAX_AGE,
    path: "/",
  });

  return { ok: true as const };
};

export const isAdminSession = async () => {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(SESSION_COOKIE);
  if (!cookie) {
    return false;
  }

  return verifySessionValue(cookie.value);
};

export const requireAdminSession = async () => {
  if (!(await isAdminSession())) {
    return false;
  }
  return true;
};

export const clearAdminSession = async () => {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 0,
    path: "/",
  });
};
