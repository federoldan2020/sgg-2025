export default function Home() {
  return (
    <div>
      <h1>PGG 2025 – Panel</h1>
      <p>Elegí una acción:</p>
      <ul>
        <li><a href="/afiliados/nuevo">Alta de Afiliado</a></li>
        <li><a href="/padrones/nuevo">Nuevo Padrón</a></li>
        <li><a href="/obligaciones/nueva">Nueva Obligación (prueba)</a></li>
        <li><a href="/caja">Caja (abrir / cobrar)</a></li>
      </ul>
      <p style={{ marginTop: 16, color: '#666' }}>
        Tip: También podés entrar directo a <code>/afiliados/nuevo</code>, <code>/padrones/nuevo</code>, etc.
      </p>
    </div>
  );
}