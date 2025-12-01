"use client";
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth';

interface AuthGateProps {
  children: React.ReactNode;
  roles?: string[]; // roles requeridos opcionales
  redirectTo?: string; // default /login
  loadingFallback?: React.ReactNode;
  forbiddenFallback?: React.ReactNode;
}

export function AuthGate({
  children,
  roles = [],
  redirectTo = '/login',
  loadingFallback = <div className="flex items-center justify-center p-8">Cargando…</div>,
  forbiddenFallback = <div className="p-8 text-center">No tenés permisos para acceder.</div>,
}: AuthGateProps) {
  const { usuario, loading, hasRole } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !usuario) {
      router.replace(redirectTo);
    }
  }, [loading, usuario, router, redirectTo]);

  if (loading) return <>{loadingFallback}</>;
  if (!usuario) return null; // redirigido
  if (roles.length > 0 && !hasRole(...roles)) return <>{forbiddenFallback}</>;
  return <>{children}</>;
}

export default AuthGate;
