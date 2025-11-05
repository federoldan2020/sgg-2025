"use client";
import { createContext, useContext, useMemo, useState } from "react";
import Header from "./Header";
import SidebarNav from "./SidebarNav";
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
  const [fakeUser] = useState<CurrentUser>({
    name: "Operador",
    roles: ["ADMIN"],
  });

  const ctx = useMemo(() => fakeUser, [fakeUser]);

  return (
    <UserContext.Provider value={ctx}>
      <div className="app-shell">
        {/* Header fijo en la parte superior */}
        <Header
          onOpenMobileNav={() => setMobileOpen(true)}
          onToggleSidebar={() => setSidebarCollapsed((prev) => !prev)}
        />

        {/* Contenedor principal con sidebar y contenido */}
        <div className="app-content">
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
  );
}
