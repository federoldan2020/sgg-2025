import type { NavGroup } from "../tipos/nav";

export const NAV_GROUPS: NavGroup[] = [
  /* ===== Afiliados ===== */
  {
    titulo: "Afiliados",
    roles: ["AFILIADOS", "ADMIN"],
    items: [
      { href: "/afiliados", label: "Afiliados" },
      { href: "/afiliados/familiares", label: "Familiares" },
      { href: "/movimientos", label: "Cuenta corriente" },
      { href: "/ordenes/nueva", label: "Nueva orden de crédito" },
     
    ],
  },

  /* ===== Operación (caja y órdenes de crédito) ===== */
  {
    titulo: "Operación",
    roles: ["OPERACION", "ADMIN"],
    items: [
      { href: "/caja", label: "Caja" },
      { href: "/ordenes", label: "Órdenes por afiliado" },
      
    ],
  },

  /* ===== Coseguro ===== */
  {
    titulo: "Coseguro",
    roles: ["COSEGURO", "ADMIN"],
    items: [
      { href: "/coseguro/", label: "Coseguro" },
      { href: "/coseguro/reintegros", label: "Reintegros" },
      { href: "/coseguro/reintegros/politicas", label: "Políticas de reintegro" },
      { href: "/farmacias", label: "Farmacias" },
    ],
  },

  /* ===== Nómina y cómputos ===== */
  {
    titulo: "Nómina y cómputos",
    roles: ["NOMINA", "ADMIN"],
    items: [
      { href: "/novedades/pendientes", label: "Novedades pendientes" },
      { href: "/novedades", label: "Generar novedades" },
      { href: "/nomina/importar-cobranza", label: "Importar cobranza (TXT)" },
      { href: "/nomina/importar-cobranza-anses", label: "Importar cobranza ANSES" },
    ],
  },

  /* ===== Terceros (maestro: proveedores / prestadores / comercios) ===== */
  {
    titulo: "Terceros",
    roles: ["TERCEROS", "TESORERIA", "FINANZAS", "ADMIN"],
    items: [
      { href: "/terceros", label: "Terceros" },
      { href: "/terceros/nuevo", label: "Nuevo tercero" },
     
    ],
  },

  /* ===== Tesorería (operativa financiera de terceros) ===== */
  {
    titulo: "Tesorería",
    roles: ["TESORERIA", "FINANZAS", "ADMIN"],
    items: [
      { href: "/terceros/comprobantes", label: "Comprobantes" },
      { href: "/terceros/ordenes-pago", label: "Órdenes de pago" },
      { href: "/finanzas/cuentas", label: "Cuentas corrientes" },
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
     
    ],
  },

  /* ===== Configuración (paramétricos) ===== */
  {
    titulo: "Configuración",
    roles: ["ADMIN"],
    items: [
      { href: "/parametricos/parentescos", label: "Parentescos" },
      { href: "/parametricos/reglas/colaterales", label: "Reglas de colaterales" },
      { href: "/parametricos/reglas/cobertura", label: "Reglas de cobertura" },
      { href: "/parametricos/reglas/clasificacion", label: "Reglas de clasificación" },
      { href: "/parametros", label: "Parámetros de cobertura" },
    ],
  },

  /* ===== Administración ===== */
  {
    titulo: "Administración",
    roles: ["ADMIN"],
    items: [
      { href: "/admin/usuarios", label: "Usuarios" },
      { href: "/admin/auditoria", label: "Auditoría" },
      { href: "/admin/movimientos-por-revisar", label: "Movimientos por revisar" },
      { href: "/admin/recalcular-saldos", label: "Recalcular saldos" },
      { href: "/cierre-mensual", label: "Cierre mensual" },
      { href: "/admin/materializar-mes", label: "Generar obligaciones" },
    ],
  },

  {
    titulo: "Importadores",
    roles: ["ADMIN"],
    items: [
      { href: "/afiliados/importar", label: "Importar afiliados" },
      { href: "/afiliados/familiares/importar", label: "Importar familiares" },
      { href: "/padrones/importar", label: "Importar padrones" },
      { href: "/parametricos/parentescos/importar", label: "Importar parentescos" },
      { href: "/contabilidad/plan/import", label: "Importar plan (CSV)" },
      { href: "/terceros/import", label: "Importar terceros" },
      { href: "/importadores/comercios", label: "Importar comercios" },
    ],
  },

  /* ===== Superadmin (dueño de plataforma) ===== */
  {
    titulo: "Superadmin",
    roles: ["SUPERADMIN"],
    items: [
      { href: "/superadmin/organizaciones", label: "Organizaciones" },
    ],
  },
];
