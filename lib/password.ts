import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

const KEY_LENGTH = 64;

export const hashPassword = (password: string) => {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, KEY_LENGTH);
  return `${salt}:${derived.toString("hex")}`;
};

export const verifyPassword = (password: string, storedHash: string) => {
  const [salt, storedKey] = storedHash.split(":");
  if (!salt || !storedKey) {
    return false;
  }

  const storedBuffer = Buffer.from(storedKey, "hex");
  const derived = scryptSync(password, salt, storedBuffer.length);
  return timingSafeEqual(storedBuffer, derived);
};
