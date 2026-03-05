'use client';

import { useAuth } from '@/contexts/auth';
import Link from 'next/link';

export default function Home() {
  const { usuario } = useAuth();

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          ¡Bienvenido, {usuario?.nombre}!
        </h1>
        <p className="text-gray-600">
          Sistema de Gestión Gremial - Panel de Control
        </p>
      </div>

      {/* Información del usuario */}
      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Información de la sesión
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <span className="font-medium text-gray-700">Usuario:</span>
            <span className="ml-2">{usuario?.nombre} {usuario?.apellido}</span>
          </div>
          <div>
            <span className="font-medium text-gray-700">Email:</span>
            <span className="ml-2">{usuario?.email}</span>
          </div>
          <div>
            <span className="font-medium text-gray-700">Roles:</span>
            <span className="ml-2">{usuario?.roles.join(', ')}</span>
          </div>
          <div>
            <span className="font-medium text-gray-700">Organización:</span>
            <span className="ml-2">UDAP</span>
          </div>
        </div>
      </div>

      {/* Acciones rápidas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Link
          href="/padrones/nuevo"
          className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow"
        >
          <div className="text-center">
            <div className="text-2xl mb-2">👥</div>
            <h3 className="font-semibold text-gray-900">Alta Afiliado / Padrón</h3>
            <p className="text-sm text-gray-600 mt-1">
              Registrar nuevo afiliado con su padrón
            </p>
          </div>
        </Link>

        <Link
          href="/afiliados"
          className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow"
        >
          <div className="text-center">
            <div className="text-2xl mb-2">📋</div>
            <h3 className="font-semibold text-gray-900">Afiliados</h3>
            <p className="text-sm text-gray-600 mt-1">
              Consultar listado de afiliados
            </p>
          </div>
        </Link>

        <Link
          href="/caja"
          className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow"
        >
          <div className="text-center">
            <div className="text-2xl mb-2">💰</div>
            <h3 className="font-semibold text-gray-900">Caja</h3>
            <p className="text-sm text-gray-600 mt-1">
              Abrir caja y cobrar
            </p>
          </div>
        </Link>

        <Link
          href="/ordenes"
          className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow"
        >
          <div className="text-center">
            <div className="text-2xl mb-2">📄</div>
            <h3 className="font-semibold text-gray-900">Órdenes</h3>
            <p className="text-sm text-gray-600 mt-1">
              Gestionar órdenes
            </p>
          </div>
        </Link>
      </div>

      <div className="mt-8 p-4 bg-blue-50 rounded-lg">
        <p className="text-sm text-blue-800">
          <strong>💡 Tip:</strong> Usa la navegación superior o el menú lateral para acceder a todas las funcionalidades del sistema.
        </p>
      </div>
    </div>
  );
}
