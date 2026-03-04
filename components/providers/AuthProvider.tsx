'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';

export type AuthUser = { id: number; username: string; role: string };

type AuthState = {
  user: AuthUser | null;
  loading: boolean;
  error: boolean;
  refreshAuth: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

let authPromise: Promise<{ user: AuthUser | null }> | null = null;

async function fetchAuth(): Promise<{ user: AuthUser | null }> {
  const res = await fetch('/api/auth/me');
  const data = (await res.json()) as { user?: AuthUser };
  return { user: data.user ?? null };
}

function getAuth(): Promise<{ user: AuthUser | null }> {
  if (!authPromise) {
    authPromise = fetchAuth();
  }
  return authPromise;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const mounted = useRef(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    authPromise = fetchAuth();
    try {
      const { user: u } = await authPromise;
      if (mounted.current) {
        setUser(u);
      }
    } catch {
      if (mounted.current) {
        setError(true);
        setUser(null);
      }
      authPromise = null;
    } finally {
      if (mounted.current) {
        setLoading(false);
      }
    }
  }, []);

  const refreshAuth = useCallback(async () => {
    await load();
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    getAuth()
      .then(({ user: u }) => {
        if (!cancelled && mounted.current) {
          setUser(u);
        }
      })
      .catch(() => {
        if (!cancelled && mounted.current) {
          setError(true);
        }
      })
      .finally(() => {
        if (!cancelled && mounted.current) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        error,
        refreshAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
