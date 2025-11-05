'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, getErrorMessage } from '@/servicios/api';
import type { OrdenCredito, OrdenCreditoCuota } from '@/tipos/modelos';

export default function OrdenesAfiliadoClient({ afiliadoId }: { afiliadoId: string }) {
  const [lista, setLista] = useState<OrdenCredito[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      const r = await api<OrdenCredito[]>(`/ordenes/${afiliadoId}`);
      setLista(r);
    } catch (e) {
      setMsg(getErrorMessage(e));
    }
  }, [afiliadoId]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  return (
    <main style={{ padding: 24 }}>
      <h1>Órdenes del Afiliado #{afiliadoId}</h1>

      {lista.map((o) => (
        <div key={String(o.id)} style={{ margin: '12px 0', padding: 12, border: '1px solid #ddd' }}>
          <div><b>Descripción:</b> {o.descripcion}</div>
          <div>
            <b>En cuotas:</b> {o.enCuotas ? 'Sí' : 'No'} |{' '}
            <b>Cuotas:</b> {o.cantidadCuotas ?? '-'} |{' '}
            <b>Cuota actual:</b> {o.cuotaActual ?? '-'}
          </div>
          <div><b>Importe total:</b> ${o.importeTotal} | <b>Saldo total:</b> ${o.saldoTotal}</div>

          {o.enCuotas && (
            <>
              <div style={{ marginTop: 8 }}><b>Cronograma</b></div>
              <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                <thead>
                  <tr>
                    <th style={{textAlign:'left'}}>#</th>
                    <th style={{textAlign:'left'}}>Período</th>
                    <th style={{textAlign:'left'}}>Importe</th>
                    <th style={{textAlign:'left'}}>Cancelado</th>
                    <th style={{textAlign:'left'}}>Saldo</th>
                    <th style={{textAlign:'left'}}>Estado</th>
                    <th style={{textAlign:'left'}}>Obligación</th>
                  </tr>
                </thead>
                <tbody>
                  {(o.cuotas ?? []).map((c: OrdenCreditoCuota) => (
                    <tr key={String(c.id)}>
                      <td>{c.numero}</td>
                      <td>{c.periodoVenc}</td>
                      <td>${c.importe}</td>
                      <td>${c.cancelado}</td>
                      <td>${c.saldo}</td>
                      <td>{c.estado}</td>
                      <td>{c.obligacionId ?? '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      ))}

      {msg && <p>{msg}</p>}
    </main>
  );
}
