export function isActive(href: string, pathname: string, exact?: boolean) {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(href + "/");
}

export type Crumb = { href: string; label: string };

const titleMap: Record<string, string> = {
  afiliados: "Afiliados",
  nuevo: "Nuevo",
  padrones: "Padrones",
  caja: "Caja",
  ordenes: "Órdenes",
  coseguro: "Coseguro",
  colaterales: "Colaterales",
  configurar: "Configurar",
  resumen: "Resumen",
  novedades: "Novedades",
  generar: "Generar",
  nomina: "Nómina",
  conciliar: "Conciliar",
  parametricos: "Paramétricos",
  parentescos: "Parentescos",
  reglas: "Reglas",
  base: "Base",
  colaterales_reglas: "Reglas por colaterales",
  contabilidad: "Contabilidad",
  plan: "Plan de cuentas",
  asientos: "Asientos",
  mapeos: "Mapeos",
  import: "Importar",
  terceros: "Terceros",
  new: "Nuevo",
  importcsv: "Importar (CSV)",
  comprobantes: "Comprobantes",
  "ordenes-pago": "Órdenes de pago",
};

export function buildCrumbs(pathname: string): Crumb[] {
  const clean = pathname.replace(/\/+$/, "");
  const parts = clean.split("/").filter(Boolean);
  const crumbs: Crumb[] = [];
  let acc = "";
  for (const part of parts) {
    acc += "/" + part;
    const label = titleMap[part] || capitalize(part);
    crumbs.push({ href: acc, label });
  }
  return crumbs;
}

function capitalize(s: string) {
  return s.replace(/[-_]/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}
