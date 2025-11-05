'use client';
import Link from 'next/link';

export default function NominaConciliarIndex() {
  return (
    <main style={{ padding: 24 }}>
      <h1>Conciliar Nómina</h1>
      <p>
        Importá un archivo de devolución de cómputos (CSV/TXT), mapeá columnas, revisá el
        <em> preview</em> y confirmá.
      </p>
      <Link href="/nomina/conciliar/nuevo">+ Nueva conciliación</Link>

      <hr style={{ margin: '16px 0' }} />

      {/* Lugar futuro: listado de lotes conciliados, con filtros por período, estado, etc. */}
      <p style={{ opacity: 0.7 }}>(Próximamente: listado de lotes)</p>
    </main>
  );
}