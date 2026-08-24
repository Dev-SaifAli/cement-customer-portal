import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type CustomerThemePreference = 'light' | 'dark' | 'system';
type ResolvedCustomerTheme = 'light' | 'dark';

interface CustomerThemeContextValue {
  preference: CustomerThemePreference;
  resolvedTheme: ResolvedCustomerTheme;
  setPreference: (preference: CustomerThemePreference) => void;
}

const STORAGE_KEY = 'customer_theme';
const CustomerThemeContext = createContext<CustomerThemeContextValue | undefined>(undefined);

function getStoredPreference(): CustomerThemePreference {
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system';
}

function resolveTheme(preference: CustomerThemePreference): ResolvedCustomerTheme {
  if (preference !== 'system') return preference;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function CustomerThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<CustomerThemePreference>(getStoredPreference);
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedCustomerTheme>(() =>
    resolveTheme(getStoredPreference()),
  );

  useEffect(() => {
    document.documentElement.dataset.customerRoute = 'true';
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const applyTheme = () => {
      const resolved = resolveTheme(preference);
      setResolvedTheme(resolved);
      document.documentElement.dataset.customerTheme = resolved;
      document.documentElement.style.colorScheme = resolved;
    };

    applyTheme();
    if (preference === 'system') mediaQuery.addEventListener('change', applyTheme);

    return () => {
      mediaQuery.removeEventListener('change', applyTheme);
      delete document.documentElement.dataset.customerRoute;
    };
  }, [preference]);

  const setPreference = (nextPreference: CustomerThemePreference) => {
    window.localStorage.setItem(STORAGE_KEY, nextPreference);
    setPreferenceState(nextPreference);
  };

  const value = useMemo(
    () => ({ preference, resolvedTheme, setPreference }),
    [preference, resolvedTheme],
  );

  return <CustomerThemeContext.Provider value={value}>{children}</CustomerThemeContext.Provider>;
}

export function useCustomerTheme() {
  const value = useContext(CustomerThemeContext);
  if (!value) throw new Error('useCustomerTheme must be used within CustomerThemeProvider');
  return value;
}
