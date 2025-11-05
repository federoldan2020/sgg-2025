import type { NavGroup } from "../tipos/nav";

export const NAV_GROUPS: NavGroup[] = [
  /* ===== Afiliados ===== */
  {
    titulo: "Afiliados",
    roles: ["AFILIADOS", "ADMIN"],
    items: [
      { href: "/afiliados", label: "ABM" },
      { href: "/movimientos", label: "Movimientos" },
      // { href: "/afiliados/nuevo", label: "Alta de afiliado" },
      //  { href: "/padrones/nuevo", label: "Alta de padrón" },
    ],
  },

  /* ===== Operación ===== */
  {
    titulo: "Operación",
    roles: ["OPERACION", "ADMIN"],
    items: [
      { href: "/caja", label: "Caja" },
      { href: "/ordenes/nueva", label: "Nueva orden de crédito" },
      { href: "/ordenes", label: "Órdenes por afiliado" },
    ],
  },

  /* ===== Coseguro ===== */
  {
    titulo: "Coseguro",
    roles: ["COSEGURO", "ADMIN"],
    items: [
      { href: "/coseguro/", label: "ABM" },
      { href: "/coseguro/colaterales", label: "Colaterales" },
      { href: "/coseguro/configurar", label: "Configurar" },
      { href: "/coseguro/resumen", label: "Resumen (consulta)" },
    ],
  },

  /* ===== Nómina ===== */
  {
    titulo: "Nómina",
    roles: ["NOMINA", "ADMIN"],
    items: [
      { href: "/novedades/generar", label: "Generar novedades" },
      { href: "/nomina/conciliar/nuevo", label: "Conciliar devolución" },
      { href: "/novedades/fechas", label: "Fecha de Corte" },
      { href: "/novedades/", label: "Monitor de novedades" },
    ],
  },

  /* ===== Tesorería (operativa financiera) ===== */
  {
    titulo: "Tesorería",
    roles: ["TESORERIA", "FINANZAS", "ADMIN"],
    items: [
      { href: "/terceros/comprobantes/nuevo", label: "Cargar comprobante" },
      { href: "/terceros/comprobantes", label: "Comprobantes" },
      { href: "/terceros/ordenes-pago/nueva", label: "Nueva orden de pago" },
      { href: "/terceros/ordenes-pago", label: "Órdenes de pago" },
      { href: "/finanzas/cuentas", label: "Cuentas de terceros" }, // ver extractos por cuenta
    ],
  },

  /* ===== Contabilidad ===== */
  {
    titulo: "Contabilidad",
    roles: ["CONTABILIDAD", "ADMIN"],
    items: [
      { href: "/contabilidad/plan", label: "Plan de cuentas" },
      { href: "/contabilidad/asientos", label: "Asientos contables" },
      { href: "/contabilidad/mapeos", label: "Mapeos" },
      { href: "/contabilidad/plan/import", label: "Importar plan (CSV)" },
    ],
  },

  /* ===== Terceros (maestro) ===== */
  {
    titulo: "Terceros",
    roles: ["TERCEROS", "ADMIN"],
    items: [
      { href: "/terceros", label: "Listado" },
      { href: "/terceros/new", label: "Nuevo tercero" },
      // la cuenta y sus comprobantes se ven desde Tesorería/Finanzas
    ],
  },

  /* ===== Paramétricos ===== */
  {
    titulo: "Paramétricos",
    roles: ["ADMIN"],
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
    titulo: "Importadores",
    roles: ["ADMIN"],
    items: [
      {
        href: "/importadores/comercios",
        icon: "upload",
        label: "Importar comercios",
      },
      { href: "/terceros/import", icon: "upload", label: "Importar Terceros" },
    ],
  },
];
/*
  {
    titulo: "Terceros",
    roles: ["TERCEROS", "ADMIN"],
    items: [
      { href: "/terceros", label: "Listado" },
      { href: "/terceros/new", label: "Nuevo tercero" },
      { href: "/terceros/import", label: "Importar (CSV)" },
      { href: "/terceros/comprobantes/nuevo", label: "Cargar comprobante" },
      { href: "/terceros/ordenes-pago/nueva", label: "Nueva orden de pago" },
    ],
  },
  */
