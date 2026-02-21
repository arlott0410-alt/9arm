import { NextResponse } from 'next/server';
import { getDb } from '@/db';
import { getSessionUser } from '@/lib/auth';
import { getSessionIdFromRequest } from '@/lib/session-cookie';
import { getEnvAndDb } from '@/lib/cf-env';
import type { User } from '@/db/schema';
import type { Role } from '@/lib/auth';
import { bootstrapSettings } from '@/lib/bootstrap';

export async function getDbAndUser(request: Request): Promise<
  | { db: ReturnType<typeof getDb>; user: User | null; env: { DB: D1Database; APP_SECRET: string; SESSION_TTL_HOURS?: string } }
  | NextResponse
> {
  const envResult = getEnvAndDb();
  if (envResult instanceof NextResponse) return envResult;
  const { db, env } = envResult;
  await bootstrapSettings(db);
  const sessionId = getSessionIdFromRequest(request);
  const user = sessionId
    ? await getSessionUser(db, sessionId, env.APP_SECRET)
    : null;
  return { db, user, env };
}

export function requireAuth(user: User | null): NextResponse | null {
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}

export function requireMutate(user: User | null): NextResponse | null {
  const authErr = requireAuth(user);
  if (authErr) return authErr;
  const role = user!.role as Role;
  if (role !== 'SUPER_ADMIN' && role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return null;
}

export function requireSettings(user: User | null): NextResponse | null {
  const authErr = requireAuth(user);
  if (authErr) return authErr;
  const role = user!.role as Role;
  if (role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return null;
}
