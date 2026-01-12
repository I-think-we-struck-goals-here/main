import "server-only";

import crypto from "crypto";
import { cookies, headers } from "next/headers";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { adminLoginAttempts } from "@/db/schema";

import { verifyPassword } from "./password";

const SESSION_COOKIE = "admin_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 30;
const SESSION_SAMESITE: "lax" | "strict" | "none" =
  process.env.NODE_ENV === "production" ? "none" : "lax";
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_MAX_ATTEMPTS = 5;

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

type AdminSessionCookie = {
  name: string;
  value: string;
  options: {
    httpOnly: true;
    sameSite: "lax" | "strict" | "none";
    secure: boolean;
    maxAge: number;
    expires: Date;
    path: "/";
  };
};

type AdminLoginResult =
  | { ok: true; cookie: AdminSessionCookie }
  | { ok: false; reason: "invalid" | "rate_limited" };

const signSession = (issuedAt: number) => {
  return crypto
    .createHmac("sha256", getSessionSecret())
    .update(String(issuedAt))
    .digest("hex");
};

const buildSessionCookie = (): AdminSessionCookie => {
  const issuedAt = Math.floor(Date.now() / 1000);
  const value = `${issuedAt}.${signSession(issuedAt)}`;
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE * 1000);

  return {
    name: SESSION_COOKIE,
    value,
    options: {
      httpOnly: true,
      sameSite: SESSION_SAMESITE,
      secure: process.env.NODE_ENV === "production",
      maxAge: SESSION_MAX_AGE,
      expires: expiresAt,
      path: "/",
    },
  };
};

export const buildClearSessionCookie = (): AdminSessionCookie => ({
  name: SESSION_COOKIE,
  value: "",
  options: {
    httpOnly: true,
    sameSite: SESSION_SAMESITE,
    secure: process.env.NODE_ENV === "production",
    maxAge: 0,
    expires: new Date(0),
    path: "/",
  },
});

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

const getAttemptRecord = async (ip: string) => {
  const [record] = await db
    .select()
    .from(adminLoginAttempts)
    .where(eq(adminLoginAttempts.ip, ip))
    .limit(1);
  return record ?? null;
};

const upsertAttemptRecord = async (
  ip: string,
  count: number,
  firstAttemptAt: Date
) => {
  const now = new Date();
  await db
    .insert(adminLoginAttempts)
    .values({
      ip,
      count,
      firstAttemptAt,
      lastAttemptAt: now,
    })
    .onConflictDoUpdate({
      target: adminLoginAttempts.ip,
      set: {
        count,
        firstAttemptAt,
        lastAttemptAt: now,
      },
    });
};

const clearAttempts = async (ip: string) => {
  await db.delete(adminLoginAttempts).where(eq(adminLoginAttempts.ip, ip));
};

export const attemptAdminLogin = async (
  password: string
): Promise<AdminLoginResult> => {
  const ip = await getClientIp();
  const now = Date.now();
  const existing = await getAttemptRecord(ip);
  if (existing) {
    const firstAttemptAtMs = existing.firstAttemptAt.getTime();
    const isWindowOpen = now - firstAttemptAtMs <= RATE_LIMIT_WINDOW_MS;
    if (isWindowOpen && existing.count >= RATE_LIMIT_MAX_ATTEMPTS) {
      return { ok: false, reason: "rate_limited" as const };
    }
  }

  const storedHash = process.env.ADMIN_PASSWORD_HASH;
  if (!storedHash) {
    throw new Error("ADMIN_PASSWORD_HASH is not set");
  }

  const isValid = verifyPassword(password, storedHash);
  if (!isValid) {
    if (!existing) {
      await upsertAttemptRecord(ip, 1, new Date(now));
    } else if (now - existing.firstAttemptAt.getTime() > RATE_LIMIT_WINDOW_MS) {
      await upsertAttemptRecord(ip, 1, new Date(now));
    } else {
      await upsertAttemptRecord(ip, existing.count + 1, existing.firstAttemptAt);
    }
    return { ok: false, reason: "invalid" as const };
  }

  await clearAttempts(ip);
  return {
    ok: true as const,
    cookie: buildSessionCookie(),
  };
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
