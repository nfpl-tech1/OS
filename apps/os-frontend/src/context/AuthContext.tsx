'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from 'react';
import { getMe, logout as apiLogout } from '@/lib/api';
import { AuthState, CurrentUser, AppTile } from '@/lib/auth.types';
import { useRouter } from 'next/navigation';

interface AuthContextValue extends AuthState {
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<AuthState>({
    user: null,
    allowed_apps: [],
    loading: true,
  });

  const refresh = async () => {
    try {
      const data = await getMe();
      setState({
        user: data.user as CurrentUser,
        allowed_apps: data.allowed_apps as AppTile[],
        loading: false,
      });
    } catch {
      setState({ user: null, allowed_apps: [], loading: false });
    }
  };

  const logout = async () => {
    await apiLogout();
    setState({ user: null, allowed_apps: [], loading: false });
    router.push('/login');
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, refresh, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
