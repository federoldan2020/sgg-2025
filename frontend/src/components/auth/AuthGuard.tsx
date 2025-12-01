'use client';

import { useAuth } from '@/contexts/auth';
import LoginForm from './LoginForm';
import { ReactNode } from 'react';

interface AuthGuardProps {
  children: ReactNode;
  requiredRoles?: string[];
}

export default function AuthGuard({ children, requiredRoles = [] }: AuthGuardProps) {
  const { usuario, loading } = useAuth();

  // Mostrar loading mientras se verifica la autenticación
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  // Si no está autenticado, mostrar login
  if (!usuario) {
    return <LoginForm />;
  }

  // Verificar roles si se especificaron
  if (requiredRoles.length > 0) {
    const hasRequiredRole = requiredRoles.some(role => 
      usuario.roles.includes(role) || usuario.roles.includes('ADMIN')
    );

    if (!hasRequiredRole) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">
              Acceso Denegado
            </h1>
            <p className="text-gray-600">
              No tienes permisos para acceder a esta sección.
            </p>
            <p className="text-sm text-gray-500 mt-2">
              Roles requeridos: {requiredRoles.join(', ')}
            </p>
            <p className="text-sm text-gray-500">
              Tus roles: {usuario.roles.join(', ')}
            </p>
          </div>
        </div>
      );
    }
  }

  // Usuario autenticado y con permisos
  return <>{children}</>;
}
