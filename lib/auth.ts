import { eq, and, gt } from 'drizzle-orm';
import type { Db } from '@/db';
import { users, sessions } from '@/db/schema';
import type { User } from '@/db/schema';
import { authCache } from '@/lib/d1-cache';
import type { Env } from '@/lib/cf-env';

export type Role = 'SUPER_ADMIN' | 'ADMIN' | 'AUDIT';

const KV_SESSION_PREFIX = 'sess:';
/** KV cache TTL: from SESSION_TTL_HOURS (capped at 1h) or 30 min default. */
function getSessionCacheTtlSeconds(env: Env): number {
  const hours = getSessionTtlHours(env);
  if (hours > 0) return Math.min(hours * 3600, 3600);
  return 1800; // 30 min
}

export function canMutate(role: Role): boolean {
  return role === 'SUPER_ADMIN' || role === 'ADMIN';
}

export function canAccessSettings(role: Role): boolean {
  return role === 'SUPER_ADMIN';
}

export function canCreateSuperadmin(role: Role): boolean {
  return false; // Only allowed when no superadmin exists
}

export async function hashPassword(
  password: string,
  salt: Uint8Array
): Promise<string> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: new Uint8Array(salt),
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );
  return Array.from(new Uint8Array(bits))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function generateSalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(16));
}

export function saltToHex(salt: Uint8Array): string {
  return Array.from(salt)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function hexToSalt(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}

export async function verifyPassword(
  password: string,
  saltHex: string,
  storedHash: string
): Promise<boolean> {
  const salt = hexToSalt(saltHex);
  const hash = await hashPassword(password, salt);
  return hash === storedHash;
}

export function generateSessionId(): string {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function getSessionTtlHours(env: { SESSION_TTL_HOURS?: string }): number {
  const h = env.SESSION_TTL_HOURS;
  if (h) {
    const n = parseInt(h, 10);
    if (!isNaN(n) && n > 0) return n;
  }
  return 24;
}

/** Minimal user shape for auth checks (avoids reading password/salt). */
export type SessionUser = Pick<User, 'id' | 'username' | 'role' | 'isActive'>;

/** Session → user with KV cache to avoid D1 on every request. Falls back to getSessionUser on miss. */
export async function getCachedSessionUser(
  db: Db,
  sessionId: string,
  env: Env
): Promise<User | null> {
  if (!sessionId || sessionId.length < 32) return null;
  if (env.KV) {
    const raw = await env.KV.get(KV_SESSION_PREFIX + sessionId);
    if (raw != null && raw !== '') {
      try {
        const u = JSON.parse(raw) as SessionUser & { isActive: boolean };
        if (!u.isActive) return null;
        return u as User;
      } catch {
        // invalid payload, fall through to D1
      }
    }
  }
  const user = await getSessionUser(db, sessionId, env.APP_SECRET);
  if (user && env.KV) {
    const payload = JSON.stringify({
      id: user.id,
      username: user.username,
      role: user.role,
      isActive: user.isActive,
    });
    await env.KV.put(KV_SESSION_PREFIX + sessionId, payload, {
      expirationTtl: getSessionCacheTtlSeconds(env),
    });
  }
  return user;
}

export async function getSessionUser(
  db: Db,
  sessionId: string,
  _appSecret: string
): Promise<User | null> {
  if (!sessionId || sessionId.length < 32) return null;

  const cached = authCache.get(sessionId);
  if (cached !== undefined) {
    if (!cached.isActive) return null;
    return cached as User;
  }

  const now = new Date();
  const sessionRows = await db
    .select({ userId: sessions.userId })
    .from(sessions)
    .where(and(eq(sessions.id, sessionId), gt(sessions.expiresAt, now)))
    .limit(1);
  const session = sessionRows[0];
  if (!session) return null;

  const userRows = await db
    .select({ id: users.id, username: users.username, role: users.role, isActive: users.isActive })
    .from(users)
    .where(and(eq(users.id, session.userId), eq(users.isActive, true)))
    .limit(1);
  const u = userRows[0];
  if (!u) return null;

  const out = { id: u.id, username: u.username, role: u.role, isActive: u.isActive };
  authCache.set(sessionId, { ...out, isActive: true });
  return out as User;
}

/** Call after logout so next request doesn't use stale cache. */
export function invalidateSessionCache(sessionId: string): void {
  authCache.invalidate(sessionId);
}

/** Remove session from KV cache on logout so stale user is not served. */
export async function deleteSessionFromKV(sessionId: string, env: Env): Promise<void> {
  if (env.KV) await env.KV.delete(KV_SESSION_PREFIX + sessionId);
}
