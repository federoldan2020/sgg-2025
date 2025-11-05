"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

type Item = { href: string; label: string };
type Grupo = { titulo: string; items: Item[] };

const grupos: Grupo[] = [
  {
    titulo: "Afiliados",
    items: [
      { href: "/afiliados", label: "Listado" },
      { href: "/afiliados/nuevo", label: "Alta de afiliado" },
      { href: "/padrones/nuevo", label: "Alta de padrón" },
    ],
  },
  {
    titulo: "Operación",
    items: [
      { href: "/caja", label: "Caja" },
      { href: "/ordenes/nueva", label: "Nueva orden de crédito" },
      { href: "/ordenes", label: "Órdenes por afiliado" },
    ],
  },
  {
    titulo: "Coseguro",
    items: [
      { href: "/coseguro/colaterales", label: "Colaterales" },
      { href: "/coseguro/configurar", label: "Configurar" },
      { href: "/coseguro/resumen", label: "Resumen (consulta)" },
    ],
  },
  {
    titulo: "Novedades",
    items: [
      { href: "/novedades/generar", label: "Generar novedades" },
      { href: "/novedades", label: "Monitor de novedades" },
      { href: "/nomina/conciliar/nuevo", label: "Conciliar devolución" },
    ],
  },
  {
    titulo: "Paramétricos",
    items: [
      { href: "/parametricos/parentescos", label: "Parentescos" },
      { href: "/parametricos/reglas/base", label: "Reglas base" },
      {
        href: "/parametricos/reglas/colaterales",
        label: "Reglas por colaterales",
      },
    ],
  },
  {
    titulo: "Contabilidad",
    items: [
      { href: "/contabilidad/plan", label: "Plan de cuentas" },
      { href: "/contabilidad/asientos", label: "Asientos contables" },
      { href: "/contabilidad/mapeos", label: "Mapeos" },
      { href: "/contabilidad/plan/import", label: "Importar plan (CSV)" },
    ],
  },
  {
    titulo: "Terceros",
    items: [
      { href: "/terceros", label: "Listado" },
      { href: "/terceros/new", label: "Nuevo tercero" },
      { href: "/terceros/import", label: "Importar (CSV)" },
      { href: "/terceros/comprobantes/nuevo", label: "Cargar comprobante" },
      { href: "/terceros/ordenes-pago/nueva", label: "Nueva orden de pago" },
    ],
  },
];

export default function Navegacion() {
  const pathname = usePathname();
  const [abierto, setAbierto] = useState(true);
  const isActive = (href: string) =>
    href === "/"
      ? pathname === "/"
      : pathname === href || pathname.startsWith(href + "/");

  return (
    <aside className="app-sidebar">
      <button
        className="menu-toggle"
        onClick={() => setAbierto(!abierto)}
        aria-expanded={abierto}
      >
        {abierto ? "▾" : "▸"} Menú
      </button>

      {abierto && (
        <nav aria-label="Menú principal">
          {grupos.map((g) => (
            <div key={g.titulo} className="nav-group">
              <div className="nav-title">{g.titulo}</div>
              <ul className="nav-list">
                {g.items.map((it) => (
                  <li key={it.href}>
                    <Link
                      href={it.href}
                      className={`nav-link ${
                        isActive(it.href) ? "active" : ""
                      }`}
                      aria-current={isActive(it.href) ? "page" : undefined}
                    >
                      {it.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      )}
    </aside>
  );
}
