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
  customerLogin,
  customerLogout,
  CustomerAuthApiError,
  getCustomerMe,
  type CustomerAuthAccount,
  type CustomerAuthUser,
} from '../services/customerAuthService';

interface CustomerAuthContextValue {
  user: CustomerAuthUser | null;
  account: CustomerAuthAccount | null;
  loading: boolean;
  restoreError: boolean;
  login: (payload: { email: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const CustomerAuthContext = createContext<CustomerAuthContextValue | undefined>(undefined);

export function CustomerAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CustomerAuthUser | null>(null);
  const [account, setAccount] = useState<CustomerAuthAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [restoreError, setRestoreError] = useState(false);

  const clearSession = () => {
    setUser(null);
    setAccount(null);
  };

  const refresh = useCallback(async () => {
    setLoading(true);
    setRestoreError(false);
    try {
      const session = await getCustomerMe();
      setUser(session.user);
      setAccount(session.account);
    } catch (error) {
      if (error instanceof CustomerAuthApiError && error.status === 401) {
        clearSession();
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
    const session = await customerLogin(payload);
    setUser(session.user);
    setAccount(session.account);
    setRestoreError(false);
  }, []);

  const logout = useCallback(async () => {
    try {
      await customerLogout();
    } finally {
      clearSession();
      setRestoreError(false);
    }
  }, []);

  const value = useMemo(
    () => ({
      user,
      account,
      loading,
      restoreError,
      login,
      logout,
      refresh,
    }),
    [account, loading, login, logout, refresh, restoreError, user],
  );

  return <CustomerAuthContext.Provider value={value}>{children}</CustomerAuthContext.Provider>;
}

export function useCustomerAuth() {
  const value = useContext(CustomerAuthContext);
  if (!value) {
    throw new Error('useCustomerAuth must be used within CustomerAuthProvider');
  }

  return value;
}
