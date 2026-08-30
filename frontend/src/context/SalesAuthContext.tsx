import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  getSalesMe,
  salesLogin,
  salesLogout,
  SalesApiError,
  type SalesUser,
} from '../services/salesService';

interface SalesAuthContextValue {
  user: SalesUser | null;
  loading: boolean;
  restoreError: boolean;
  login: (payload: { email: string; password: string }) => Promise<SalesUser>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const SalesAuthContext = createContext<SalesAuthContextValue | undefined>(undefined);

export function SalesAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SalesUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [restoreError, setRestoreError] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setRestoreError(false);
    try {
      const currentUser = await getSalesMe();
      setUser(currentUser);
    } catch (error) {
      if (error instanceof SalesApiError && error.status === 401) {
        setUser(null);
      } else {
        setRestoreError(true);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = useCallback(async (payload: { email: string; password: string }) => {
    const loggedInUser = await salesLogin(payload);
    setUser(loggedInUser);
    setRestoreError(false);
    return loggedInUser;
  }, []);

  const logout = useCallback(async () => {
    try {
      await salesLogout();
    } finally {
      setUser(null);
      setRestoreError(false);
    }
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      restoreError,
      login,
      logout,
      refresh,
    }),
    [loading, login, logout, refresh, restoreError, user],
  );

  return <SalesAuthContext.Provider value={value}>{children}</SalesAuthContext.Provider>;
}

export function useSalesAuth() {
  const value = useContext(SalesAuthContext);
  if (!value) {
    throw new Error('useSalesAuth must be used within SalesAuthProvider');
  }

  return value;
}
