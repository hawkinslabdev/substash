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
  const createdAt = Date.now();
  const expiresAt =
    sessionHours === 0 ? null : createdAt + sessionHours * 3600 * 1000;
  const expiryStr = expiresAt?.toString() ?? "0";
  const hmac = await hmacSha256hex(
    `${sessionId}:${createdAt}:${expiryStr}`,
    `${pinHash}${shareSecret}`,
  );
  return { token: `${sessionId}.${createdAt}.${expiryStr}.${hmac}`, expiresAt };
}

export async function validateSessionToken(
  token: string,
  pinHash: string,
  shareSecret: string,
  sessionHours?: number,
): Promise<boolean> {
  const parts = token.split(".");
  if (parts.length !== 4) return false;

  const [sessionId, createdAtStr, expiryStr, storedHmac] = parts;
  const expectedHmac = await hmacSha256hex(
    `${sessionId}:${createdAtStr}:${expiryStr}`,
    `${pinHash}${shareSecret}`,
  );
  if (!timingSafeEqual(expectedHmac, storedHmac)) return false;

  const createdAt = parseInt(createdAtStr, 10);
  const expiresAt = parseInt(expiryStr, 10);
  const now = Date.now();

  if (expiresAt !== 0 && now > expiresAt) return false;

  if (sessionHours && sessionHours > 0) {
    const elapsed = now - createdAt;
    if (elapsed > sessionHours * 3600_000) return false;
  }

  return true;
}
