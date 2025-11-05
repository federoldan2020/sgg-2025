// src/app/contabilidad/plan/page.tsx
"use client";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/servicios/api";

type Nodo = {
  id: string | number;
  codigo: string;
  nombre: string;
  tipo: string;
  imputable: boolean;
  hijos?: Nodo[];
};

function matchNodo(n: Nodo, q: string) {
  if (!q) return true;
  const t = q.toLowerCase();
  return (
    n.codigo.toLowerCase().includes(t) || n.nombre.toLowerCase().includes(t)
  );
}

// Devuelve el árbol filtrado; conserva ramas ancestro si dentro hay un match
function filtrarArbol(nodos: Nodo[], q: string): Nodo[] {
  if (!q) return nodos;
  const out: Nodo[] = [];
  for (const n of nodos) {
    const hijos = n.hijos ? filtrarArbol(n.hijos, q) : [];
    if (matchNodo(n, q) || hijos.length > 0) {
      out.push({ ...n, hijos });
    }
  }
  return out;
}

const NodeView = ({
  n,
  nivel = 0,
  autoExpandido,
}: {
  n: Nodo;
  nivel?: number;
  autoExpandido?: boolean;
}) => {
  const [open, setOpen] = useState<boolean>(!!autoExpandido);
  const tieneHijos = !!(n.hijos && n.hijos.length);

  useEffect(() => {
    if (autoExpandido) setOpen(true);
  }, [autoExpandido]);

  const getAccountTypeColor = (tipo: string) => {
    switch (tipo.toLowerCase()) {
      case "activo":
        return "account-type-activo";
      case "pasivo":
        return "account-type-pasivo";
      case "patrimonio":
        return "account-type-patrimonio";
      case "resultado":
      case "resultados":
        return "account-type-resultado";
      case "orden":
        return "account-type-orden";
      default:
        return "account-type-default";
    }
  };

  const getAccountIcon = (tipo: string, tieneHijos: boolean) => {
    if (tieneHijos) {
      return (
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
        </svg>
      );
    }
    return (
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14,2 14,8 20,8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <line x1="10" y1="9" x2="8" y2="9" />
      </svg>
    );
  };

  return (
    <li className="account-node">
      <div
        className={`account-item ${
          tieneHijos ? "account-parent" : "account-leaf"
        }`}
        style={{ paddingLeft: `${nivel * 24}px` }}
      >
        <div className="account-expand">
          {tieneHijos ? (
            <button
              onClick={() => setOpen((v) => !v)}
              className={`expand-button ${open ? "expanded" : ""}`}
              aria-label={open ? "Contraer" : "Expandir"}
              title={open ? "Contraer" : "Expandir"}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="9,18 15,12 9,6" />
              </svg>
            </button>
          ) : (
            <div className="expand-spacer" />
          )}
        </div>

        <div className="account-icon">{getAccountIcon(n.tipo, tieneHijos)}</div>

        <div className="account-code">{n.codigo}</div>

        <div className="account-name">{n.nombre}</div>

        <div className="account-badges">
          <span className={`account-type-badge ${getAccountTypeColor(n.tipo)}`}>
            {n.tipo}
          </span>
          {!n.imputable && (
            <span className="account-imputable-badge">No imputable</span>
          )}
        </div>
      </div>

      {tieneHijos && open && (
        <ul className="account-children">
          {n.hijos!.map((h) => (
            <NodeView
              key={String(h.id)}
              n={h}
              nivel={nivel + 1}
              autoExpandido={autoExpandido}
            />
          ))}
        </ul>
      )}
    </li>
  );
};

export default function PlanCtasPage() {
  const [arbol, setArbol] = useState<Nodo[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [expandAll, setExpandAll] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const data = await api<Nodo[]>("/contabilidad/plan/arbol");
        setArbol(data);
        setMsg(null);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (e: any) {
        setMsg(
          `Error al cargar el plan de cuentas: ${
            e.message || "Error desconocido"
          }`
        );
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const filtrado = useMemo(() => filtrarArbol(arbol, q.trim()), [arbol, q]);

  const handleExpandAll = () => {
    setExpandAll((prev) => !prev);
  };

  const handleClearSearch = () => {
    setQ("");
  };

  const totalCuentas = useMemo(() => {
    const countNodes = (nodos: Nodo[]): number => {
      return nodos.reduce((count, nodo) => {
        return count + 1 + (nodo.hijos ? countNodes(nodo.hijos) : 0);
      }, 0);
    };
    return countNodes(arbol);
  }, [arbol]);

  const cuentasImputables = useMemo(() => {
    const countImputables = (nodos: Nodo[]): number => {
      return nodos.reduce((count, nodo) => {
        const current = nodo.imputable ? 1 : 0;
        const children = nodo.hijos ? countImputables(nodo.hijos) : 0;
        return count + current + children;
      }, 0);
    };
    return countImputables(arbol);
  }, [arbol]);

  return (
    <div className="page-container">
      {/* Header de página */}
      <div className="page-header">
        <div className="page-title-section">
          <h1 className="page-title">Plan de Cuentas</h1>
          <p className="page-subtitle">
            Estructura contable y clasificación de cuentas
          </p>
        </div>
        <div className="page-actions">
          <a href="/contabilidad/plan/importar" className="btn btn-secondary">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7,10 12,15 17,10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Importar Plan
          </a>
        </div>
      </div>

      {/* Mensaje de error */}
      {msg && (
        <div className="alert alert-error">
          <div className="alert-content">
            <div className="alert-icon">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            </div>
            <div className="alert-text">{msg}</div>
          </div>
        </div>
      )}

      <div className="page-content">
        {/* Controles y estadísticas */}
        <div className="plan-controls">
          <div className="search-section">
            <div className="search-container">
              <div className="search-input-container">
                <svg
                  className="search-icon"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.35-4.35" />
                </svg>
                <input
                  className="search-input"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Buscar por código o nombre de cuenta..."
                />
                {q && (
                  <button
                    onClick={handleClearSearch}
                    className="search-clear"
                    title="Limpiar búsqueda"
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                )}
              </div>
            </div>

            <button
              onClick={handleExpandAll}
              className="btn btn-secondary"
              title={expandAll ? "Contraer todas" : "Expandir todas"}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                {expandAll ? (
                  <>
                    <polyline points="4,14 10,14 10,20" />
                    <polyline points="20,10 14,10 14,4" />
                    <line x1="14" y1="10" x2="21" y2="3" />
                    <line x1="3" y1="21" x2="10" y2="14" />
                  </>
                ) : (
                  <>
                    <polyline points="15,3 21,3 21,9" />
                    <polyline points="9,21 3,21 3,15" />
                    <line x1="21" y1="3" x2="14" y2="10" />
                    <line x1="3" y1="21" x2="10" y2="14" />
                  </>
                )}
              </svg>
              {expandAll ? "Contraer Todas" : "Expandir Todas"}
            </button>
          </div>

          {!loading && (
            <div className="plan-stats">
              <div className="stat-item">
                <div className="stat-value">{totalCuentas}</div>
                <div className="stat-label">Total Cuentas</div>
              </div>
              <div className="stat-item">
                <div className="stat-value">{cuentasImputables}</div>
                <div className="stat-label">Imputables</div>
              </div>
              <div className="stat-item">
                <div className="stat-value">
                  {q ? filtrado.length : arbol.length}
                </div>
                <div className="stat-label">
                  {q ? "Resultados" : "Nivel Raíz"}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Contenido del plan */}
        <div className="plan-content">
          {loading ? (
            <div className="loading-state">
              <div className="loading-icon">
                <svg
                  className="spinner"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
              </div>
              <div className="loading-text">Cargando plan de cuentas...</div>
            </div>
          ) : filtrado.length > 0 ? (
            <div className="account-tree-container">
              <ul className="account-tree">
                {filtrado.map((n) => (
                  <NodeView
                    key={String(n.id)}
                    n={n}
                    autoExpandido={!!q || expandAll}
                  />
                ))}
              </ul>
            </div>
          ) : arbol.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📊</div>
              <div className="empty-state-title">Plan de cuentas vacío</div>
              <div className="empty-state-text">
                No hay cuentas configuradas en el sistema. Importa un plan de
                cuentas para comenzar.
              </div>
              <a href="/contabilidad/plan/importar" className="btn btn-primary">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7,10 12,15 17,10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Importar Plan de Cuentas
              </a>
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-state-icon">🔍</div>
              <div className="empty-state-title">Sin resultados</div>
              <div className="empty-state-text">
                No se encontraron cuentas que coincidan con &quot;{q}&quot;
              </div>
              <button onClick={handleClearSearch} className="btn btn-secondary">
                Limpiar búsqueda
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
