"use client";
import { createContext, useContext, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import Header from "./Header";
import SidebarNav from "./SidebarNav";
import AuthGuard from "../auth/AuthGuard";
import { useAuth } from "@/contexts/auth";
import type { Role } from "../../tipos/nav";

// Contexto simple para simular usuario actual
export type CurrentUser = { name: string; roles: Role[] };
const UserContext = createContext<CurrentUser>({
  name: "Operador",
  roles: ["ADMIN"],
});
export const useCurrentUser = () => useContext(UserContext);

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { usuario } = useAuth();
  const pathname = usePathname();

  // Mapear roles del usuario autenticado al formato esperado por el nav
  const userRoles: Role[] = usuario?.roles as Role[] || [];
  const ctx = useMemo(() => ({
    name: usuario ? `${usuario.nombre} ${usuario.apellido}` : "Usuario",
    roles: userRoles,
  }), [usuario]);

  // Si estamos en la página de login, no usar AuthGuard ni layout
  if (pathname === '/login') {
    return <>{children}</>;
  }

  return (
    <AuthGuard>
      <UserContext.Provider value={ctx}>
        <div className="relative min-h-screen bg-neutral-50">
          <Header
            onOpenMobileNav={() => setMobileOpen(true)}
            onToggleSidebar={() => setSidebarCollapsed((prev) => !prev)}
            sidebarCollapsed={sidebarCollapsed}
          />

          <SidebarNav
            roles={ctx.roles}
            mobileOpen={mobileOpen}
            setMobileOpen={setMobileOpen}
            collapsed={sidebarCollapsed}
            onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
          />

          <main className={`pt-14 transition-all duration-300 ${sidebarCollapsed ? 'lg:pl-[72px]' : 'lg:pl-64'} min-h-screen bg-neutral-50`}>
            <div className="min-h-[calc(100vh-3.5rem)] p-4 sm:p-6 lg:p-8">
              <div className="mx-auto max-w-7xl">
                {children}
              </div>
            </div>
          </main>
        </div>
      </UserContext.Provider>
    </AuthGuard>
  );
}
