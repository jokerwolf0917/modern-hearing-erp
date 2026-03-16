import { createContext, useContext, useMemo, useState } from 'react';
import type { PropsWithChildren } from 'react';

import { login as loginRequest, type IEmployee } from '../services/auth';

const ACCESS_TOKEN_KEY = 'erp_access_token';
const EMPLOYEE_KEY = 'erp_employee';

interface AuthContextValue {
  employee: IEmployee | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function readStoredEmployee(): IEmployee | null {
  const raw = localStorage.getItem(EMPLOYEE_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as IEmployee;
  } catch {
    localStorage.removeItem(EMPLOYEE_KEY);
    return null;
  }
}

export function AuthProvider({ children }: PropsWithChildren): JSX.Element {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(ACCESS_TOKEN_KEY));
  const [employee, setEmployee] = useState<IEmployee | null>(() => readStoredEmployee());

  const value = useMemo<AuthContextValue>(
    () => ({
      employee,
      token,
      isAuthenticated: Boolean(token && employee),
      login: async (username: string, password: string) => {
        const response = await loginRequest(username, password);
        localStorage.setItem(ACCESS_TOKEN_KEY, response.access_token);
        localStorage.setItem(EMPLOYEE_KEY, JSON.stringify(response.employee));
        setToken(response.access_token);
        setEmployee(response.employee);
      },
      logout: () => {
        localStorage.removeItem(ACCESS_TOKEN_KEY);
        localStorage.removeItem(EMPLOYEE_KEY);
        setToken(null);
        setEmployee(null);
      },
    }),
    [employee, token],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

export function clearStoredAuth(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(EMPLOYEE_KEY);
}
