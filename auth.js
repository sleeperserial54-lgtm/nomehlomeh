import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);

export async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = (await scrypt(password, salt, 64)).toString("hex");
  return `${salt}:${hash}`;
}

export async function verifyPassword(password, storedValue) {
  const [salt, storedHash] = storedValue.split(":");
  if (!salt || !storedHash) return false;
  const hash = Buffer.from(await scrypt(password, salt, 64));
  const expected = Buffer.from(storedHash, "hex");
  return expected.length === hash.length && timingSafeEqual(expected, hash);
}
