'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, LogOut, User, Settings } from 'lucide-react';
import { useAuth } from '@/contexts/auth';

export default function UserMenu() {
  const { usuario, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  if (!usuario) {
    return null;
  }

  const handleLogout = () => {
    logout();
    setIsOpen(false);
  };

  const initials = `${usuario.nombre.charAt(0)}${usuario.apellido.charAt(0)}`.toUpperCase();

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 rounded-lg border border-transparent px-2 py-1.5 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-medical-500 focus:ring-offset-2 hover:bg-neutral-50 hover:border-neutral-200"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-medical-100 text-xs font-semibold text-medical-700">
          {initials}
        </div>
        <span className="hidden max-w-[120px] truncate text-left text-neutral-700 lg:inline-block">
          {usuario.nombre} {usuario.apellido}
        </span>
        <ChevronDown
          className={`size-4 shrink-0 text-neutral-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <div
          className="absolute right-0 z-50 mt-2 w-64 origin-top-right rounded-xl border border-neutral-200 bg-white py-1.5 shadow-lg ring-1 ring-black/5"
          role="menu"
        >
          <div className="border-b border-neutral-100 px-4 py-3">
            <div className="truncate text-sm font-semibold text-neutral-900">
              {usuario.nombre} {usuario.apellido}
            </div>
            <div className="mt-0.5 truncate text-xs text-neutral-500">{usuario.email}</div>
            <span className="mt-1.5 inline-block rounded-md bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-600">
              {usuario.roles?.[0] ?? 'Usuario'}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-neutral-700 transition-colors hover:bg-neutral-50"
            role="menuitem"
          >
            <User className="size-4 text-neutral-500" />
            Mi Perfil
          </button>

          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-neutral-700 transition-colors hover:bg-neutral-50"
            role="menuitem"
          >
            <Settings className="size-4 text-neutral-500" />
            Configuración
          </button>

          <div className="border-t border-neutral-100">
            <button
              type="button"
              onClick={handleLogout}
              className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
              role="menuitem"
            >
              <LogOut className="size-4" />
              Cerrar Sesión
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
