# DOC-03 API Spec Reintegros (borrador)

## Convenciones
- Header obligatorio: `X-Organizacion-ID`
- IDs como `string | number | bigint` (seguimos estilo actual)
- Respuestas con `{ ok: true }` en mutaciones simples

## Endpoints core

### Solicitudes
**POST `/reintegros/solicitudes`**
Crear borrador.
Request:
```
{
  "personaTipo": "TITULAR" | "FAMILIAR",
  "afiliadoId": "123",
  "familiarId": "456", // requerido si personaTipo=FAMILIAR
  "tipo": "MEDICAMENTO" | "PRACTICA",
  "fechaFactura": "YYYY-MM-DD",
  "items": [
    { "descripcion": "string", "cantidad": 1, "importe": 1000, "tipoItem": "MEDICAMENTO" }
  ]
}
```
Response:
```
{ "id": "1", "estado": "BORRADOR" }
```
Errores:
- 400 datos invalidos
- 404 afiliado/familiar no encontrado

**PUT `/reintegros/solicitudes/:id`**
Editar borrador.
Request: mismos campos del create (items reemplazan).
Response: `{ ok: true }`
Errores:
- 409 si estado no es `BORRADOR`

**POST `/reintegros/solicitudes/:id/presentar`**
Valida y cambia estado a `PRESENTADO`.
Request: `{ observacion?: string }`
Response: `{ ok: true, estado: "PRESENTADO" }`
Errores:
- 409 si faltan adjuntos/requisitos
- 409 si duplicado detectado
- 409 si no elegible por coseguro (baja/suspendido)

**GET `/reintegros/solicitudes`**
Listado con filtros.
Query:
`?q=...&estado=...&tipo=...&afiliadoId=...&desde=YYYY-MM-DD&hasta=YYYY-MM-DD&page=1&pageSize=20`

**GET `/reintegros/solicitudes/:id`**
Detalle completo con items, adjuntos e historial.

### Adjuntos
**POST `/reintegros/solicitudes/:id/adjuntos`**
Request (metadata):
```
{ "tipoAdjunto": "FACTURA|RECETA|ORDEN|INFORME|OTRO", "url": "https://...", "hash": "...", "mime": "application/pdf", "size": 12345 }
```
Response: `{ id: "1" }`

### Workflow
**POST `/reintegros/solicitudes/:id/observar`**
Request: `{ observacion: "string" }`
Response: `{ ok: true, estado: "OBSERVADO" }`

**POST `/reintegros/solicitudes/:id/aprobar`**
Request:
```
{ "importeAprobado": 1500, "detalle?: string" }
```
Response: `{ ok: true, estado: "APROBADO" }`

**POST `/reintegros/solicitudes/:id/rechazar`**
Request:
```
{ "motivo": "string", "observacion?": "string" }
```
Response: `{ ok: true, estado: "RECHAZADO" }`

### Pagos
**POST `/reintegros/solicitudes/:id/orden-pago`**
Genera orden de pago y pasa a `A_PAGAR`.

**POST `/reintegros/solicitudes/:id/pagar`**
Request:
```
{ "medioPago": "EFECTIVO|TRANSFERENCIA|CHEQUE|OTRO", "monto": 1500, "fechaPago": "YYYY-MM-DD" }
```
Response: `{ ok: true, estado: "PAGADO" }`

### Validaciones
**POST `/reintegros/validar`**
Preview de elegibilidad y calculo de cobertura.
Request:
```
{
  "personaTipo": "TITULAR|FAMILIAR",
  "afiliadoId": "123",
  "familiarId": "456",
  "tipo": "MEDICAMENTO|PRACTICA",
  "fechaFactura": "YYYY-MM-DD",
  "importe": 2000
}
```
Response:
```
{
  "eligible": true,
  "motivos": [],
  "topeDisponible": 5000,
  "importeSugerido": 1400,
  "consumos": {
    "ordenesGrupoUsadas": 2,
    "ordenesGrupoMax": 4,
    "medicamentosPorOrdenMax": 2,
    "opticaUsadoAnual": true
  }
}
```

## DTOs y validaciones (resumen)
- `personaTipo` requerido, `afiliadoId` requerido
- Si `personaTipo=FAMILIAR`, `familiarId` requerido y debe pertenecer al afiliado
- `fechaFactura` valida y no futura (regla sugerida)
- `items[]` debe existir en create/presentar
- `importeAprobado` no puede superar suma de items
- max 4 ordenes por grupo familiar (parametrizable)
- max 2 medicamentos por orden (parametrizable)
- topes por prestaciones (ej: optica 1 marco + 1 par de cristales por anio)
- bloquear si coseguro esta `suspendido` o `baja`

## Errores estandar
- 400: datos invalidos
- 404: recurso no encontrado
- 409: conflicto de estado (workflow) o no elegible

## Ejemplos
Crear borrador:
```
POST /reintegros/solicitudes
X-Organizacion-ID: org_1

{
  "personaTipo": "TITULAR",
  "afiliadoId": "123",
  "tipo": "MEDICAMENTO",
  "fechaFactura": "2026-01-20",
  "items": [
    { "descripcion": "Ibuprofeno 600", "cantidad": 1, "importe": 2500, "tipoItem": "MEDICAMENTO" }
  ]
}
```
