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
        <div className="app-shell">
          {/* Header fijo en la parte superior */}
          <Header
            onOpenMobileNav={() => setMobileOpen(true)}
            onToggleSidebar={() => setSidebarCollapsed((prev) => !prev)}
          />

          {/* Contenedor principal con sidebar y contenido */}
          <div className={`app-content ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
            <SidebarNav
              roles={ctx.roles}
              mobileOpen={mobileOpen}
              setMobileOpen={setMobileOpen}
              collapsed={sidebarCollapsed}
              onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
            />

            <main className="app-main">{children}</main>
          </div>
        </div>
      </UserContext.Provider>
    </AuthGuard>
  );
}
