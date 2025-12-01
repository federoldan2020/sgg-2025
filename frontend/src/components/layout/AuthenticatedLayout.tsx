'use client';

import { ReactNode } from 'react';
import { useAuth } from '@/contexts/auth';
import UserMenu from '../auth/UserMenu';
import Link from 'next/link';

interface AuthenticatedLayoutProps {
  children: ReactNode;
}

export default function AuthenticatedLayout({ children }: AuthenticatedLayoutProps) {
  const { usuario } = useAuth();

  if (!usuario) {
    return null; // El AuthGuard se encargará de mostrar el login
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo y título */}
            <div className="flex items-center">
              <Link href="/" className="flex items-center space-x-2">
                <div className="h-8 w-8 bg-indigo-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">SGG</span>
                </div>
                <span className="text-xl font-semibold text-gray-900">
                  Sistema de Gestión Gremial
                </span>
              </Link>
            </div>

            {/* Navegación principal */}
            <nav className="hidden md:flex space-x-8">
              <Link
                href="/afiliados"
                className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
              >
                Afiliados
              </Link>
              <Link
                href="/caja"
                className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
              >
                Caja
              </Link>
              <Link
                href="/contabilidad/plan"
                className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
              >
                Contabilidad
              </Link>
              <Link
                href="/ordenes"
                className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
              >
                Órdenes
              </Link>
            </nav>

            {/* Usuario y logout */}
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-600">
                Organización: <span className="font-medium">UDAP</span>
              </div>
              <UserMenu />
            </div>
          </div>
        </div>
      </header>

      {/* Contenido principal */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}
