import { NextResponse } from 'next/server';
import { getDb } from '@/db';
import { getCachedSessionUser } from '@/lib/auth';
import { getSessionIdFromRequest } from '@/lib/session-cookie';
import { getEnvAndDb } from '@/lib/cf-env';
import type { User } from '@/db/schema';
import type { Role } from '@/lib/auth';
import { ensureBootstrapped } from '@/lib/bootstrap';

export async function getDbAndUser(request: Request): Promise<
  | { db: ReturnType<typeof getDb>; user: User | null; env: import('@/lib/cf-env').Env }
  | NextResponse
> {
  const envResult = getEnvAndDb();
  if (envResult instanceof NextResponse) return envResult;
  const { db, env } = envResult;
  await ensureBootstrapped(db, env);
  const sessionId = getSessionIdFromRequest(request);
  const user = sessionId
    ? await getCachedSessionUser(db, sessionId, env)
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

export function requireWallets(user: User | null): NextResponse | null {
  const authErr = requireAuth(user);
  if (authErr) return authErr;
  const role = user!.role as Role;
  if (role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return null;
}
