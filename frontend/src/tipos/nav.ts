// filepath: types/nav.ts
export type Role =
  | "ADMIN"
  | "OPERACION"
  | "COSEGURO"
  | "NOMINA"
  | "CONTABILIDAD"
  | "TERCEROS"
  | "AFILIADOS"
  | "ALL"
  | "FINANZAS"
  | "TESORERIA";


export type NavItem = {
  href: string;
  label: string;
  icon?: React.ReactNode;
  roles?: Role[]; // visible a todos si falta
  exact?: boolean; // default: false (startsWith)
};

export type NavGroup = {
  titulo: string;
  items: NavItem[];
  roles?: Role[]; // grupo visible a roles
};
