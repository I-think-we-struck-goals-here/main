import "server-only";

import crypto from "crypto";
import { cookies, headers } from "next/headers";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { adminLoginAttempts } from "@/db/schema";

import { verifyPassword } from "./password";

const SESSION_COOKIE = "admin_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 7;
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

export const attemptAdminLogin = async (password: string) => {
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
