type Props = {
  params: Promise<{ afiliadoId: string }>;
};


const tabs = [
  { id: "resumen", label: "Resumen" },
  { id: "colaterales", label: "Colaterales" },
  { id: "cc", label: "Cuenta Corriente" },
  { id: "eventos", label: "Eventos" },
] as const;

export default async function AfiliadoDetallePage({ params }: Props) {
  const { afiliadoId } = await params;

  return (
    <section>
      <header style={{ marginBottom: 12 }}>
        <h1 className="section-title">Afiliado #{afiliadoId}</h1>
        <p className="helper">Vista 360° del afiliado</p>
      </header>

      <div style={{ display: "flex", gap: 8, borderBottom: "1px solid var(--border)", marginBottom: 16 }}>
        {tabs.map((t) => (
          <a
            key={t.id}
            href={`/afiliados/${afiliadoId}?tab=${t.id}`}
            className="nav-link active" // placeholder; luego manejamos activo real
          >
            {t.label}
          </a>
        ))}
      </div>

      <div className="card">
        <div className="card-body">
          <h3 style={{ marginTop: 0 }}>Resumen</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <div className="helper">Apellido y nombre</div>
              <div>Pérez, Juan</div>
            </div>
            <div>
              <div className="helper">DNI</div>
              <div>30.123.456</div>
            </div>
            <div>
              <div className="helper">Padrones</div>
              <div>
                <span className="chip">A-123</span> <span className="chip">B-55</span>
              </div>
            </div>
            <div>
              <div className="helper">Coseguro</div>
              <div>
                <span className="badge badge-yes">Sí — Titular: A-123</span>
              </div>
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <div className="helper">Imputación adicional (colaterales)</div>
              <div>
                <span className="chip">Padrón destino: B-55</span>
              </div>
              <p
                style={{
                  marginTop: 8,
                  background: "var(--warning-100)",
                  border: "1px solid #FDE68A",
                  color: "#92400E",
                  borderRadius: 6,
                  padding: "6px 8px",
                }}
              >
                Recordatorio: las modificaciones posteriores al día 10 impactan el período siguiente (corte 10→10).
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
