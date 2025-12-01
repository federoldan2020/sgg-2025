'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authLogin, authLogout, authMe } from '../servicios/api';

export type Usuario = {
  id: string;
  email: string;
  nombre: string;
  apellido: string;
  roles: string[];
  organizacionId: string;
};

export type AuthState = {
  usuario: Usuario | null;
  loading: boolean;
  error?: string;
};

export type AuthContextType = {
  usuario: Usuario | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  hasRole: (...roles: string[]) => boolean;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({ usuario: null, loading: true });

  const refreshProfile = useCallback(async () => {
    try {
      const perfil = await authMe();
      setState((s) => ({ ...s, usuario: perfil, loading: false, error: undefined }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'No se pudo obtener el perfil';
      setState({ usuario: null, loading: false, error: msg });
    }
  }, []);

  useEffect(() => {
    // Al iniciar, intentar hidratar sesión
    void refreshProfile();
  }, [refreshProfile]);

  const login = useCallback(async (email: string, password: string) => {
    const ok = await authLogin({ email, password });
    if (ok) {
      await refreshProfile();
    }
    return ok;
  }, [refreshProfile]);

  const logout = useCallback(async () => {
    await authLogout();
    setState({ usuario: null, loading: false });
  }, []);

  const hasRole = useCallback((...roles: string[]) => {
    const userRoles = state.usuario?.roles || [];
    if (userRoles.includes('ADMIN')) return true;
    return roles.some((r) => userRoles.includes(r));
  }, [state.usuario]);

  const value = useMemo<AuthContextType>(() => ({
    usuario: state.usuario,
    loading: state.loading,
    login,
    logout,
    hasRole,
    refreshProfile,
  }), [state.usuario, state.loading, login, logout, hasRole, refreshProfile]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}

// HOC simple para proteger vistas por rol
export function RequireRole({ roles, children }: { roles: string[]; children: React.ReactNode }) {
  const { loading, hasRole } = useAuth();
  if (loading) return null;
  return hasRole(...roles) ? <>{children}</> : <div>No tenés permisos para acceder.</div>;
}
