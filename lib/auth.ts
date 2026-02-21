import { eq, and, gt } from 'drizzle-orm';
import type { Db } from '@/db';
import { users, sessions } from '@/db/schema';
import type { User } from '@/db/schema';

export type Role = 'SUPER_ADMIN' | 'ADMIN' | 'AUDIT';

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

export async function getSessionUser(
  db: Db,
  sessionId: string,
  appSecret: string
): Promise<User | null> {
  if (!sessionId || sessionId.length < 32) return null;
  const now = new Date();
  const sessionRows = await db
    .select()
    .from(sessions)
    .where(
      and(
        eq(sessions.id, sessionId),
        gt(sessions.expiresAt, now)
      )
    )
    .limit(1);
  const session = sessionRows[0];
  if (!session) return null;
  const userRows = await db
    .select()
    .from(users)
    .where(and(eq(users.id, session.userId), eq(users.isActive, true)))
    .limit(1);
  return userRows[0] ?? null;
}
