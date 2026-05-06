import {
  hmacSha256hex,
  generateToken,
  timingSafeEqual,
} from "@/lib/utils/crypto";

export const SESSION_COOKIE = "substash:session";

export async function createSessionToken(
  pinHash: string,
  shareSecret: string,
  sessionHours: number,
): Promise<{ token: string; expiresAt: number | null }> {
  const sessionId = generateToken(32);
  const expiresAt =
    sessionHours === 0 ? null : Date.now() + sessionHours * 3600 * 1000;
  const expiryStr = expiresAt?.toString() ?? "0";
  const hmac = await hmacSha256hex(
    `${sessionId}:${expiryStr}`,
    `${pinHash}${shareSecret}`,
  );
  return { token: `${sessionId}.${expiryStr}.${hmac}`, expiresAt };
}

export async function validateSessionToken(
  token: string,
  pinHash: string,
  shareSecret: string,
): Promise<boolean> {
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [sessionId, expiryStr, storedHmac] = parts;
  const expectedHmac = await hmacSha256hex(
    `${sessionId}:${expiryStr}`,
    `${pinHash}${shareSecret}`,
  );
  if (!timingSafeEqual(expectedHmac, storedHmac)) return false;
  const expiresAt = parseInt(expiryStr, 10);
  if (expiresAt !== 0 && Date.now() > expiresAt) return false;
  return true;
}
