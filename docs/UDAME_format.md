# Formato de archivo UDAME — Padrón de descuentos previsionales ANSES → UDA

Especificación del archivo de texto plano de ancho fijo que ANSES envía
mensualmente a UDA con los descuentos aplicados a los haberes de
jubilados y pensionados afiliados.

Ejemplo de nombre: `UDAME606.TXT` (donde `606` representa el período
`06/2026`, formato MMAA aplicado al nombre).

Parser implementado en:
[backend/src/modulos/nomina/parsers/anses.parser.ts](../backend/src/modulos/nomina/parsers/anses.parser.ts)

## 1. Características físicas

| Propiedad | Valor |
|---|---|
| Codificación | `latin-1` (ISO-8859-1) |
| Terminador de línea | `\r\n` (CRLF) |
| Largo total de línea | **131 chars** |
| Largo útil por registro | **103 chars** (pos 1 a 103) |
| Padding final | 28 bytes nulos (`\x00`) entre el char 103 y el `\r\n` |
| Estructura | Ancho fijo, sin headers, un registro por línea |

> Los bytes nulos al final de cada línea deben ser stripeados antes de
> parsear. La utilidad del registro termina en la posición 103.

## 2. Layout de campos (posiciones 1-indexadas)

| Pos. | Largo | Campo | Tipo | Descripción |
|---:|---:|---|---|---|
| 1–11 | 11 | `beneficio` | string numérico | Número de beneficio ANSES |
| 12–33 | 22 | `apellidoNombre` | string | Apellido y nombre, padded con espacios |
| 34–36 | 3 | `tipoPrestacion` | string | Código interno (PD4, K74, PP4, DN4, etc.). **Ignorable**. |
| 37–44 | 8 | `dni` | string numérico | DNI (8 dígitos con padding 0) |
| 45–47 | 3 | constante `"325"` | — | **Ignorar** |
| 48–61 | 14 | zona administrativa | — | Empieza con `"4140"`. **Ignorable** |
| **62–72** | **11** | **`monto`** | **decimal** | **9 enteros + 2 decimales. Sin separador.** Padding `0` a la izquierda |
| 73–76 | 4 | `periodo` | string `MMAA` | Período liquidado. Ej.: `0626` = junio 2026 |
| 77–87 | 11 | `cuit` | string numérico | CUIT/CUIL del beneficiario (11 dígitos) |
| 88–97 | 10 | `fechaNacimiento` | fecha `DD.MM.YYYY` | Con puntos como separador |
| 98 | 1 | `sexo` | char | `F` o `M` |
| 99–100 | 2 | padding | — | Siempre `"  "`. **Ignorar** |
| 101–103 | 3 | `organismo` | string | Siempre `"UDA"` |

## 3. Reglas de validación implementadas

1. **Largo útil ≥ 103** (después de strippear `\x00`, `\r`, `\n`).
2. **`beneficio` y `cuit` son 11 dígitos numéricos.**
3. **`dni` 8 dígitos numéricos.**
4. **`monto` 11 dígitos numéricos.** Se divide por 100 para obtener decimales.
5. **`periodo` formato MMAA con mes válido 01-12.** Se convierte a `YYYY-MM`.
6. **`fechaNacimiento` formato `DD.MM.YYYY` parseable.**
7. **Warning** (no error) si `cuit.substr(2, 8) !== dni`.
8. **Warning** si `organismo !== "UDA"`.

Los warnings se reportan pero **no detienen el parseo**.

## 4. Detalle de los campos clave

### `monto` (pos 62–72)

11 chars con 9 enteros + 2 decimales. **Leer siempre 11 chars completos**
o se rompe con montos ≥ $1.000.000.

- `"00001689218"` → 16.892,18
- `"00011094353"` → 110.943,53
- `"00014423580"` → 144.235,80
- `"00023269004"` → 232.690,04

### `beneficio` (pos 1–11)

Cadena de 11 dígitos. **Conservar siempre como string** porque puede
arrancar con `0`.

### `cuit` (pos 77–87)

11 dígitos. Estructura `PP-DDDDDDDD-V` (prefijo + DNI + verificador), sin
guiones en el archivo.

### `periodo` (pos 73–76)

MMAA → `YYYY-MM` (siglo 20XX).

- `0525` → `2025-05`
- `0626` → `2026-06`
- `1224` → `2024-12`

Normalmente todos los registros del archivo comparten el mismo período.

## 5. Solo J17

A diferencia del TXT de Cómputos (que trae J17, J22, J38, K16), **ANSES
sólo descuenta J17 (cuota societaria)** a los jubilados. Los conceptos de
coseguro/colaterales/órdenes de crédito de los jubilados se cobran por
caja o débito automático, no por ANSES.

→ El procesador de cobranza ANSES no necesita aplicar a obligaciones
J22/J38/K16; cada registro es una cobranza J17 del beneficio/DNI
indicado para el período del archivo.

## 6. Ejemplo

Línea cruda (los `·` representan los 28 bytes nulos finales antes del CRLF):

```
51010330540HERRERA FRANCISCO GABRDN407933688325414002428592250001442358006262007933688320.09.1942M  UDA····························\r\n
```

Parseado:

```json
{
  "beneficio": "51010330540",
  "apellidoNombre": "HERRERA FRANCISCO GABR",
  "tipoPrestacion": "DN4",
  "dni": 7933688,
  "dniRaw": "07933688",
  "monto": 144235.8,
  "periodo": "2026-06",
  "cuit": "20079336883",
  "fechaNacimiento": "1942-09-20T00:00:00.000Z",
  "sexo": "M",
  "organismo": "UDA"
}
```

## 7. Encoding — atención al leer el archivo

El archivo está en **`latin-1`**. En Node se lee así:

```ts
const contenido = Buffer.from(fileBuffer).toString('latin1');
```

Si se decodifica como UTF-8, los nombres con tildes / ñ se rompen.

## 8. Casos extremos

- **Montos en cero**: válido (afiliado con beneficio activo pero sin
  descuento aplicado el mes en cuestión). No descartar.
- **Beneficios duplicados**: no debería ocurrir, pero el parser no
  deduplica. Si se necesita, hacerlo en una capa posterior.
- **Líneas vacías o malformadas**: el parser las marca como error con la
  línea cruda + motivo, pero no rompe el procesamiento.
