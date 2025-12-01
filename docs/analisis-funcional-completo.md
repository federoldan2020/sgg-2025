# Análisis Funcional Completo - SGG 2025

> **Fecha:** 26 de noviembre de 2025  
> **Sistema:** Sistema de Gestión Gremial 2025  
> **Stack:** NestJS + Prisma + PostgreSQL (Backend) | Next.js 15 + React 19 (Frontend)

---

## 📋 ÍNDICE

1. [Módulos Operativos](#módulos-operativos)
2. [Módulos de Configuración](#módulos-de-configuración)
3. [Módulos de Integración](#módulos-de-integración)
4. [Flujos Críticos](#flujos-críticos)
5. [Limitaciones Actuales](#limitaciones-actuales)
6. [Roadmap Funcional](#roadmap-funcional)

---

## 1. MÓDULOS OPERATIVOS

### 🔐 1.1 AUTENTICACIÓN Y USUARIOS

#### ✅ **Implementado:**
- **Login/Logout** con JWT (15 min) + Refresh tokens (30 días)
- **Gestión de usuarios**: crear, modificar, activar, desactivar, bloquear, eliminar
- **Roles disponibles**: ADMIN, OPERACION, COSEGURO, NOMINA, CONTABILIDAD, TERCEROS, AFILIADOS, FINANZAS, TESORERIA, CAJA, SOLO_LECTURA
- **Estados de usuario**: ACTIVO, INACTIVO, BLOQUEADO, PENDIENTE_ACTIVACION
- **Sesiones**: tracking por IP, UserAgent, dispositivo, familia de tokens
- **Seguridad**: 
  - Reintentos fallidos y bloqueo temporal
  - Cambio forzado de password en primer login
  - Invalidación de sesiones (logout individual o global)
  - Validación de sede para operaciones (caja)
  - Cross-tenant protection (orgMiddleware)

#### ⚠️ **Limitaciones:**
- No hay recuperación de contraseña por email (reset manual por admin)
- No hay 2FA (autenticación de dos factores)
- No hay auditoría detallada de acciones por usuario (solo login tracking)
- No hay permisos granulares por recurso (solo por rol general)

#### 🎯 **Se puede hacer:**
- Login con email/password
- Ver perfil propio
- Cambiar contraseña
- Admin: CRUD completo de usuarios
- Admin: ver sesiones activas por usuario
- Admin: forzar logout de usuario específico
- Validar roles en endpoints protegidos
- Restringir operaciones por sede del usuario

#### ❌ **No se puede hacer:**
- Recuperar contraseña olvidada sin admin
- Login con SSO/OAuth
- Definir permisos custom por usuario
- Auditar qué datos modificó cada usuario

---

### 👥 1.2 AFILIADOS

#### ✅ **Implementado:**
- **CRUD completo**: crear, modificar, consultar, eliminar (soft delete)
- **Búsqueda**: por DNI, nombre, apellido, número de socio
- **Suggest**: autocompletado para selección rápida
- **Paginación**: listado con filtros
- **Datos**: 
  - Personales: DNI, CUIT, nombre, apellido, sexo, fecha nacimiento, tipo (TITULAR, FAMILIAR, JUBILADO)
  - Contacto: teléfono, celular
  - Domicilio completo: calle, número, piso, depto, barrio, localidad, etc.
  - Financieros: cupo general, saldo consolidado
  - Observaciones

#### ⚠️ **Limitaciones:**
- No hay validación de CUIT/DNI con AFIP
- No hay gestión de documentación adjunta (fotos, PDFs)
- No hay historial de cambios de datos
- No hay validación de duplicados por nombre/apellido (solo por DNI/CUIT)
- No hay merge de afiliados duplicados

#### 🎯 **Se puede hacer:**
- Alta de afiliado con datos completos
- Búsqueda rápida por DNI o nombre
- Modificar todos los datos personales
- Ver padrones asociados
- Ver obligaciones pendientes
- Ver movimientos de cuenta corriente
- Consultar cupo y saldo actual
- Soft delete (marca inactivo, no elimina físicamente)

#### ❌ **No se puede hacer:**
- Validar identidad con organismos externos
- Adjuntar documentación
- Ver historial de modificaciones
- Detectar duplicados automáticamente
- Fusionar registros duplicados
- Importación masiva desde CSV/Excel (falta implementar)

---

### 📋 1.3 PADRONES

#### ✅ **Implementado:**
- **CRUD completo**: crear, modificar, consultar, eliminar
- **Datos clave**:
  - Identificación: padron, centro, sector, clase, situación
  - Fechas: alta, baja
  - Estado: activo/inactivo
  - Parámetros económicos: J17, J22, J38, K16 (códigos de descuento)
  - Sistema: ESC, SGR, SG
  - Financiero: sueldo básico, cupo, saldo
  - Jubilados: caja ahorro, beneficiario
- **Relación**: cada padrón pertenece a un afiliado

#### ⚠️ **Limitaciones:**
- No hay validación de formato de código de padrón
- No hay importación masiva
- No hay generación automática de código
- No hay bloqueo de edición de padrones con movimientos

#### 🎯 **Se puede hacer:**
- Alta de padrón para afiliado
- Modificar parámetros (J17, J22, etc.)
- Activar/desactivar padrón
- Consultar por afiliado
- Asociar a obligaciones y movimientos

#### ❌ **No se puede hacer:**
- Importar padrones desde nómina externa
- Validar unicidad de código de padrón entre organizaciones
- Transferir padrón entre afiliados
- Ver historial de cambios de parámetros

---

### 💰 1.4 CAJA

#### ✅ **Implementado:**
- **Flujo completo de caja diaria**:
  1. **Apertura**: `POST /caja/abrir` (valida sede del usuario)
  2. **Cobro**: `POST /caja/cobrar` (con validaciones)
  3. **Cierre**: `POST /caja/cerrar` (genera asiento contable)
- **Consulta estado**: `GET /caja/estado`
- **Métodos de pago múltiples**: efectivo, tarjeta, transferencia, QR, otro
- **Soporte multimoneda**: ARS, USD con tipo de cambio
- **Aplicación a obligaciones**: selección manual de qué obligaciones pagar
- **Generación automática de**:
  - Asiento contable (según mapeos configurados)
  - Movimientos de cuenta corriente de afiliado
  - Actualización de saldos
- **Restricciones**:
  - Solo una caja abierta por sede
  - Usuario solo opera en su sede asignada
  - No se puede cobrar obligaciones bloqueadas (enviadas a nómina)

#### ⚠️ **Limitaciones:**
- No hay impresión de recibos directa desde cobro (módulo de impresión separado)
- No hay conciliación de tarjetas/transferencias
- No hay arqueo de caja al cierre
- No hay manejo de cambio/vuelto
- No hay registro de billetes/monedas
- No hay caja chica/gastos menores
- No se puede anular un cobro (requiere ajuste manual)
- No hay reportes de caja por operador

#### 🎯 **Se puede hacer:**
- Abrir caja al inicio del día (por sede)
- Cobrar a afiliado con múltiples métodos de pago
- Aplicar parcialmente a obligaciones específicas
- Cobrar en USD con conversión automática a ARS
- Cerrar caja generando asiento contable
- Consultar estado de caja actual
- Ver obligaciones pendientes de afiliado antes de cobrar

#### ❌ **No se puede hacer:**
- Imprimir recibo en el momento del cobro
- Anular un cobro ya registrado
- Hacer arqueo de efectivo
- Registrar gastos desde caja
- Ver resumen de cobranzas del día antes de cerrar
- Cobrar obligaciones ya enviadas a nómina (bloqueadas)
- Generar créditos a favor manualmente (solo por conciliación)
- Reabrir caja cerrada

---

### 📊 1.5 OBLIGACIONES

#### ✅ **Implementado:**
- **Creación manual**: `POST /obligaciones` (para ajustes)
- **Consulta por afiliado**: `GET /obligaciones/por-afiliado?afiliadoId=...`
- **Tipos de origen**: liquidacion, orden_credito, complemento_minimo, ajuste
- **Estados**: pendiente, parcialmente_pagada, pagada, anulada
- **Tracking de nómina**:
  - `bloqueada`: enviada a nómina, no se puede cobrar en caja
  - `conciliacionEstado`: pendiente, descontado, no_descontado, parcial, ajustado
  - `conciliacionImporte`: monto efectivamente descontado
  - `conciliacionFecha`: cuándo se concilió
- **Relación a concepto**: define tipo de descuento (CUOTA_SOC, COSEGURO, ADIC_COL, ORDEN_CREDITO)

#### ⚠️ **Limitaciones:**
- No hay generación automática de obligaciones periódicas (cuota social)
- No hay anulación masiva
- No hay recálculo automático de intereses
- No hay planes de pago (refinanciación)
- No hay descuentos/bonificaciones

#### 🎯 **Se puede hacer:**
- Crear obligación manual para ajuste
- Consultar obligaciones de afiliado (pendientes, pagas, bloqueadas)
- Ver estado de conciliación vs nómina
- Aplicar pago desde caja (si no está bloqueada)
- Filtrar por período, concepto, estado

#### ❌ **No se puede hacer:**
- Generar cuotas sociales automáticas mensualmente
- Anular múltiples obligaciones a la vez
- Crear planes de financiación
- Aplicar descuentos porcentuales
- Ver proyección de deuda futura

---

### 💳 1.6 ÓRDENES DE CRÉDITO

#### ✅ **Implementado:**
- **Preview**: `POST /ordenes/preview` (simula cuotas sin grabar)
- **Creación**: `POST /ordenes` (crea cabecera + cuotas)
- **Consulta**: `GET /ordenes/:afiliadoId`
- **Características**:
  - Asociación a comercio (importado desde DBF)
  - Tipo: pago único o en cuotas
  - Sistema de amortización: FRANCES, ALEMAN, DIRECTO
  - Tasa de interés configurable
  - Pre-materialización: genera cuotas futuras al crear orden
  - Estados: pendiente, en_curso, cancelada, anulada
  - Cuotas individuales con estado propio
- **Integración**:
  - Cuotas se convierten en obligaciones al generar novedades del período
  - Código K16 en nómina agrupa órdenes de crédito

#### ⚠️ **Limitaciones:**
- No hay aprobación workflow (se crea directamente)
- No hay límite de cupo automático
- No hay validación de capacidad de pago
- No hay refinanciación de órdenes existentes
- No hay intereses punitorios por mora
- No hay cancelación anticipada con bonificación
- No hay firma digital del afiliado

#### 🎯 **Se puede hacer:**
- Simular cuotas antes de crear
- Crear orden de crédito en cuotas
- Ver órdenes activas de afiliado
- Materializar cuotas futuras (X meses adelante)
- Consultar detalle de cuotas (vencimientos, saldos)
- Anular orden completa

#### ❌ **No se puede hacer:**
- Aprobar/rechazar órdenes (workflow)
- Validar cupo disponible automáticamente
- Refinanciar deuda existente
- Aplicar castigos por mora
- Cancelar anticipadamente con descuento
- Firmar digitalmente
- Modificar cuotas ya generadas

---

### 🏥 1.7 COSEGURO Y COLATERALES

#### ✅ **Implementado:**
- **Gestión de coseguro**:
  - Alta/baja de afiliado en coseguro
  - Configuración de padrón de imputación
  - Precio base vigente por período
- **Gestión de colaterales (grupo familiar)**:
  - CRUD de colaterales (familiar dependiente)
  - Validación de DNI único por afiliado
  - Parentescos configurables (CONYUGE, HIJO/A, PADRE/MADRE)
  - Reglas de precio por tramos de cantidad
  - Flag `esColateral` para distinguir familiares no adheridos
- **Reglas de precio**:
  - Coseguro: precio base vigente por período
  - Colaterales: precio por parentesco + tramos de cantidad
  - Vigencias con fecha desde/hasta
  - Sistema de borradores para publicación (draft → publicada)
- **Cálculo automático en novedades**: precio base + colaterales según reglas vigentes

#### ⚠️ **Limitaciones:**
- No hay validación de edad para hijos (límite 21 años)
- No hay renovación automática de colaterales mayores
- No hay cobertura diferenciada por prestación
- No hay copago variable
- No hay auditoría médica
- No hay gestión de autorizaciones

#### 🎯 **Se puede hacer:**
- Dar alta afiliado en coseguro
- Agregar/quitar colaterales
- Configurar padrón de imputación
- Crear reglas de precio con vigencia
- Publicar reglas desde borradores
- Calcular precio total automáticamente
- Generar obligaciones mensuales (J22, J38)

#### ❌ **No se puede hacer:**
- Validar edades límite automáticamente
- Gestionar autorizaciones médicas
- Registrar prestaciones consumidas
- Configurar copagos variables
- Auditar uso de coseguro
- Bloquear coseguro por falta de pago

---

### 📝 1.8 NÓMINA Y NOVEDADES

#### ✅ **Implementado:**
- **Generación de novedades**:
  - `POST /novedades/generar?periodo=YYYY-MM`
  - Calcula: coseguro base, colaterales, cuotas de órdenes
  - Mapea conceptos a códigos DPI (J22, J38, K16)
  - Genera lote con items por afiliado/padrón/código
  - Exporta a TXT formato DPI
  - Materializa cuotas de órdenes como obligaciones
  - Marca obligaciones como bloqueadas (no cobrables en caja)
- **Importación de devolución de nómina**:
  - `POST /nomina/preview` (carga archivo, crea lote previsualizado)
  - `POST /nomina/confirmar/:loteId` (aplica conciliación)
- **Conciliación automática**:
  - Compara monto enviado vs descontado
  - Aplica descuentos a obligaciones
  - Genera crédito a favor si hay sobrante (doble cobro)
  - Marca obligaciones como conciliadas
- **Eventos/buffer**:
  - `NovedadPendiente`: eventos PADRON_ALTA, PADRON_BAJA, COSEGURO_ALTA, etc.
  - `NovedadPendientePadron`: resumen por padrón/período (aditivo J17/J22/J38/K16)
  - Calendario de corte configurable por período

#### ⚠️ **Limitaciones:**
- No hay validación de formato del archivo de nómina
- No hay reenvío de novedades
- No hay gestión de rechazos individuales
- No hay reportes de diferencias
- No hay alertas de doble cobro
- No hay devolución al afiliado del crédito a favor (solo queda registrado)

#### 🎯 **Se puede hacer:**
- Generar novedades para período completo
- Exportar TXT para enviar a nómina
- Importar archivo de devolución
- Previsualizar conciliación antes de confirmar
- Confirmar conciliación (aplica a obligaciones)
- Ver resumen de novedades por concepto
- Ver obligaciones conciliadas vs pendientes
- Registrar créditos a favor por sobrante

#### ❌ **No se puede hacer:**
- Validar formato del archivo automáticamente
- Reenviar novedades corregidas
- Gestionar rechazos puntuales
- Generar reportes de diferencias
- Notificar afiliados con doble cobro
- Devolver crédito a favor al afiliado (falta implementar uso)
- Anular conciliación confirmada

---

### 📚 1.9 CONTABILIDAD

#### ✅ **Implementado:**
- **Plan de cuentas**:
  - CRUD de cuentas contables
  - Jerarquía padre/hijo
  - Tipos: activo, pasivo, patrimonio, ingreso, gasto
  - Niveles configurables
  - Cuentas imputables vs agrupadores
  - Importación desde CSV
- **Mapeos contables**:
  - Por origen de operación (pago_caja, cierre_caja, orden_pago_tercero)
  - Por concepto (CUOTA_SOC, COSEGURO, ORDEN_CREDITO)
  - Por método de pago (efectivo, tarjeta, transferencia)
  - Por moneda (ARS, USD)
  - Define: código debe + código haber
  - Seeds automáticos para mapeos estándar
- **Asientos contables**:
  - Generación automática desde:
    - Caja: cobro (por cada método de pago) + cierre
    - Terceros: orden de pago
  - Consulta de asientos con filtros
  - Detalle con líneas debe/haber
  - Exportación a CSV
  - Referencia al origen (pagoId, ordenPagoId)
- **Integración**:
  - Todo cobro/pago genera asiento automáticamente
  - Cuenta corriente de afiliados trackeada

#### ⚠️ **Limitaciones:**
- No hay cierre de ejercicio
- No hay libros contables (Diario, Mayor)
- No hay balance automático
- No hay estado de resultados
- No hay asientos de ajuste por inflación
- No hay conciliación bancaria
- No hay validación de cuadre (debe = haber) antes de guardar
- No hay anulación de asientos (son inmutables)

#### 🎯 **Se puede hacer:**
- Crear plan de cuentas completo
- Importar plan desde CSV
- Configurar mapeos por origen/concepto/método
- Ver asientos generados automáticamente
- Filtrar asientos por fecha/origen
- Exportar asientos a CSV
- Consultar movimientos por cuenta

#### ❌ **No se puede hacer:**
- Cerrar ejercicio contable
- Generar libros legales
- Ver balance general
- Ver estado de resultados
- Crear asientos manuales (solo automáticos)
- Anular/modificar asientos
- Conciliar con extractos bancarios
- Ajustar por inflación

---

### 🏢 1.10 TERCEROS Y FINANZAS

#### ✅ **Implementado:**
- **CRUD de terceros**:
  - Tipos: FISICA, JURIDICA
  - Roles: PROVEEDOR, PRESTADOR, AFILIADO, OTRO
  - Datos: nombre, CUIT, IIBB, condición IVA
  - Direcciones múltiples (fiscal, comercial)
  - Contactos múltiples (email, teléfono, WhatsApp)
  - Datos bancarios (CBU, ALIAS, CVU)
  - Configuración impositiva (exenciones, percepciones)
  - Clasificaciones (tags agrupadores)
  - Importación masiva desde CSV
- **Cuentas por rol**:
  - Cada tercero tiene cuenta por rol (PROVEEDOR, PRESTADOR)
  - Saldo inicial y actual
  - Movimientos trackeados (débito/crédito)
- **Comprobantes**:
  - Tipos: FACTURA, PRESTACION, NOTA_CREDITO, NOTA_DEBITO
  - Clases AFIP: A, B, C, M, X
  - Datos fiscales completos (IVA 21/10.5/27, percepciones, retenciones)
  - Líneas de detalle
  - Estados: borrador, emitido, contabilizado, pagado, anulado
  - Generación de movimientos en cuenta
- **Órdenes de pago**:
  - Aplicación a múltiples comprobantes
  - Métodos de pago: transferencia, cheque, efectivo
  - Numeración correlativa automática
  - Estados: borrador, confirmado, anulado
  - Generación de asiento contable
- **Extracto de cuenta**: movimientos de tercero por rol

#### ⚠️ **Limitaciones:**
- No hay validación con AFIP (CUIT, constancia inscripción)
- No hay integración con factura electrónica
- No hay retenciones automáticas (manual)
- No hay gestión de cheques (posdatados, cartera)
- No hay conciliación bancaria de pagos
- No hay reportes de compras/gastos
- No hay libro IVA compras
- No hay gestión de presupuestos

#### 🎯 **Se puede hacer:**
- Alta de proveedor/prestador con datos completos
- Importar terceros desde CSV
- Crear factura con impuestos calculados
- Registrar prestaciones médicas
- Generar orden de pago aplicando a facturas
- Ver extracto de cuenta de tercero
- Consultar comprobantes pendientes de pago
- Anular comprobantes

#### ❌ **No se puede hacer:**
- Validar CUIT con AFIP
- Generar factura electrónica
- Calcular retenciones automáticamente
- Gestionar cheques posdatados
- Conciliar pagos con banco
- Generar libro IVA
- Crear presupuestos
- Aprobar facturas (workflow)

---

### 📄 1.11 IMPRESIÓN Y COMPROBANTES

#### ✅ **Implementado:**
- **Sistema de numeración**:
  - Correlativos por organización + tipo + punto de venta + serie
  - Formatos: A4, A5, TICKET_80MM
  - Padding configurable (ej: 00000001)
- **Tipos de comprobantes**:
  - ORDEN_PAGO
  - RECIBO_AFILIADO
  - REINTEGRO_AFILIADO
- **Generación**:
  - Templates Nunjucks + CSS
  - Generación de PDF con Puppeteer
  - Storage (filesystem o S3)
  - Hash SHA256 para deduplicación
  - Snapshot del payload original (DTO congelado)
- **Consulta**:
  - Por ID, tipo, fecha
  - Descarga de PDF
  - Estados: EMITIDO, ANULADO
- **Detalle**: ítems/líneas con cantidad, precio unitario, importe

#### ⚠️ **Limitaciones:**
- No hay impresión directa (solo descarga PDF)
- No hay email automático
- No hay WhatsApp
- No hay reimpresión con marca de agua
- No hay templates editables por usuario
- No hay logo personalizable por organización
- No hay firma digital

#### 🎯 **Se puede hacer:**
- Generar orden de pago con PDF
- Generar recibo de cobro a afiliado
- Descargar PDF generado
- Anular comprobante
- Ver historial de comprobantes emitidos

#### ❌ **No se puede hacer:**
- Imprimir directamente sin descarga
- Enviar por email automáticamente
- Enviar por WhatsApp
- Editar template sin código
- Personalizar logo por organización
- Firmar digitalmente
- Reimprimir con marca "DUPLICADO"

---

### 💼 1.12 MOVIMIENTOS DE AFILIADO (CUENTA CORRIENTE)

#### ✅ **Implementado:**
- **Tipos de movimiento**:
  - Débitos: orden_credito, cuota, ajuste
  - Créditos: pago_caja, nomina, ajuste, anulacion
- **Datos trackeados**:
  - Fecha
  - Naturaleza (débito/crédito)
  - Origen (trazabilidad)
  - Concepto (descripción)
  - Importe (siempre positivo, signo por naturaleza)
  - Moneda original + tipo de cambio
  - Referencias: obligacionId, ordenId, cuotaId, pagoId
  - Saldo posterior (running balance)
  - Asiento contable asociado (opcional)
- **Consultas**:
  - Por afiliado con filtros (fecha, tipo)
  - Paginación
  - Exportación

#### ⚠️ **Limitaciones:**
- No hay ajuste masivo
- No hay anulación de movimientos (son inmutables)
- No hay reportes de morosidad
- No hay scoring crediticio
- No hay alertas de saldo negativo
- No hay bloqueo automático por deuda

#### 🎯 **Se puede hacer:**
- Ver cuenta corriente completa de afiliado
- Filtrar por rango de fechas
- Filtrar por tipo de movimiento
- Ver saldo running (saldo después de cada movimiento)
- Crear ajuste manual (débito o crédito)
- Rastrear origen de cada movimiento
- Ver movimientos en USD convertidos a ARS

#### ❌ **No se puede hacer:**
- Anular movimientos
- Ajustar múltiples afiliados a la vez
- Generar reportes de morosidad
- Calcular scoring
- Configurar alertas de deuda
- Bloquear servicios por mora

---

## 2. MÓDULOS DE CONFIGURACIÓN

### ⚙️ 2.1 PARAMETRICOS

#### ✅ **Implementado:**
- **Parentescos**: código, descripción, activo
- **Conceptos**: código (ej: CUOTA_SOC, COSEGURO), nombre, activo
- **Reglas de precio**: coseguro base + colaterales por tramos
- **Códigos de nómina**: mapeo concepto → código DPI (J22, K16, etc.)
- **Calendario de corte**: día de corte por período para novedades

#### ⚠️ **Limitaciones:**
- No hay configuración de tasas de interés generales
- No hay configuración de tipos de cambio
- No hay parámetros por sede
- No hay vigencias automáticas (fechas from/to manuales)

#### 🎯 **Se puede hacer:**
- Crear/editar parentescos
- Crear/editar conceptos
- Configurar reglas de precio con vigencia
- Configurar calendario de corte

#### ❌ **No se puede hacer:**
- Configurar tasas globales
- Importar tipos de cambio automáticamente
- Configurar parámetros por delegación
- Activar/desactivar vigencias automáticamente por fecha

---

### 🏗️ 2.2 ORGANIZACIONES

#### ✅ **Implementado:**
- **Modelo base**: nombre, activo
- **Multitenancy completo**: todas las entidades filtran por `organizacionId`
- **Configuración**: `OrganizacionConfig` (clave/valor para flags)
- **Header validation**: `X-Organizacion-ID` obligatorio y validado contra usuario

#### ⚠️ **Limitaciones:**
- No hay CRUD de organizaciones desde UI
- No hay configuración de branding (logo, colores)
- No hay límites de uso (cuotas, storage)
- No hay subdominios personalizados

#### 🎯 **Se puede hacer:**
- Operar con múltiples organizaciones aisladas
- Configurar flags específicos (bloquearCobroCajaObligacionesEnviadas)
- Validar acceso cross-tenant

#### ❌ **No se puede hacer:**
- Crear organizaciones desde UI
- Personalizar apariencia por organización
- Limitar uso por plan
- Asignar subdominios

---

## 3. MÓDULOS DE INTEGRACIÓN

### 📥 3.1 IMPORTADORES

#### ✅ **Implementado:**
- **Terceros desde CSV**: preview + confirmación
- **Plan de cuentas desde CSV**: carga directa
- **Comercios desde DBF**: importación legacy

#### ⚠️ **Limitaciones:**
- No hay importación de afiliados/padrones
- No hay importación de obligaciones
- No hay importación de movimientos históricos
- No hay validación de integridad referencial
- No hay rollback de importaciones

#### 🎯 **Se puede hacer:**
- Importar terceros desde Excel/CSV
- Importar plan de cuentas
- Importar comercios legacy

#### ❌ **No se puede hacer:**
- Importar padrón desde nómina externa
- Importar saldos iniciales
- Validar referencias cruzadas
- Revertir importación

---

### 📤 3.2 EXPORTADORES

#### ✅ **Implementado:**
- **Novedades a TXT**: formato DPI para envío a nómina
- **Asientos a CSV**: exportación contable
- **Comprobantes a PDF**: vía módulo de impresión

#### ⚠️ **Limitaciones:**
- No hay exportación de reportes a Excel
- No hay exportación de extractos bancarios
- No hay exportación de libros contables
- No hay integración con sistemas contables externos (Tango, Bejerman)

#### 🎯 **Se puede hacer:**
- Exportar novedades formato DPI
- Exportar asientos a CSV
- Descargar comprobantes PDF

#### ❌ **No se puede hacer:**
- Exportar reportes personalizados
- Integrar con software contable
- Exportar libros IVA
- Exportar SICORE/SIRE

---

## 4. FLUJOS CRÍTICOS

### 🔄 4.1 FLUJO DE COBRO EN CAJA

**Paso a paso:**
1. ✅ Operador abre caja (valida sede)
2. ✅ Busca afiliado por DNI/nombre
3. ✅ Consulta obligaciones pendientes
4. ✅ Selecciona obligaciones a pagar
5. ✅ Indica métodos de pago (efectivo, tarjeta, etc.)
6. ✅ Sistema genera:
   - Pago con aplicaciones
   - Movimientos de cuenta corriente
   - Asiento contable
   - Actualiza saldos
7. ⚠️ **Falta**: Imprimir recibo automáticamente
8. ✅ Al finalizar día: cierra caja (asiento de cierre)

**Validaciones:**
- ✅ Solo una caja abierta por sede
- ✅ Usuario opera solo en su sede
- ✅ No se pueden cobrar obligaciones bloqueadas (enviadas a nómina)
- ✅ Monto total coincide con suma de aplicaciones
- ❌ **Falta**: Arqueo de efectivo

---

### 🔄 4.2 FLUJO DE NÓMINA COMPLETO

**Paso a paso:**
1. ✅ Admin configura calendario de corte
2. ✅ Sistema genera novedades del período:
   - Calcula coseguro base (precio vigente)
   - Calcula colaterales (reglas por tramos)
   - Materializa cuotas de órdenes de crédito como obligaciones
   - Mapea conceptos a códigos DPI (J22, J38, K16)
3. ✅ Exporta TXT formato DPI
4. ✅ Usuario envía a Computación del Gobierno
5. ⏳ **Manual**: Computación procesa y devuelve archivo
6. ✅ Usuario importa archivo de devolución (preview)
7. ✅ Sistema concilia:
   - Compara monto enviado vs descontado
   - Aplica a obligaciones
   - Genera crédito a favor si hay sobrante
   - Marca obligaciones como conciliadas
8. ✅ Confirma conciliación
9. ❌ **Falta**: Notificar afiliados con doble cobro
10. ❌ **Falta**: Devolver crédito a favor

**Validaciones:**
- ✅ No se envían dos veces obligaciones del mismo período
- ✅ Obligaciones enviadas no se pueden cobrar en caja
- ✅ Sobrantes generan crédito a favor (no devuelve efectivo)
- ❌ **Falta**: Validar formato de archivo de devolución

---

### 🔄 4.3 FLUJO DE ORDEN DE CRÉDITO

**Paso a paso:**
1. ✅ Operador crea orden para afiliado:
   - Selecciona comercio
   - Define monto, cantidad de cuotas, tasa
   - Preview simula cuotas
2. ✅ Confirma creación:
   - Genera cabecera + cuotas pre-materializadas
   - Estado: pendiente
3. ✅ Al generar novedades del período:
   - Cuota del período → Obligacion
   - Obligacion → NovedadItem (código K16)
   - Marca cuota como "generada"
4. ✅ Afiliado paga:
   - Por nómina (conciliación aplica a obligación)
   - Por caja (si no está en nómina)
5. ✅ Sistema actualiza:
   - Saldo de cuota
   - Saldo de orden
   - Estado de cuota (pagada)
   - Movimiento de cuenta corriente

**Validaciones:**
- ✅ No se duplican obligaciones de cuotas ya generadas
- ❌ **Falta**: Validar cupo disponible antes de aprobar
- ❌ **Falta**: Workflow de aprobación
- ❌ **Falta**: Cancelación anticipada con bonificación

---

### 🔄 4.4 FLUJO DE COSEGURO

**Paso a paso:**
1. ✅ Admin da alta afiliado en coseguro:
   - Define padrón de imputación
   - Fecha de alta
2. ✅ Admin agrega colaterales (familiares):
   - DNI, nombre, parentesco, fecha nacimiento
3. ✅ Sistema calcula precio mensual:
   - Base (regla vigente)
   - Colaterales (suma por tramos de cada parentesco)
4. ✅ Al generar novedades:
   - Coseguro base → Obligacion (concepto COSEGURO, código J22)
   - Colaterales → Obligacion (concepto ADIC_COL, código J38)
5. ✅ Afiliado paga por nómina o caja
6. ✅ Admin da baja coseguro:
   - Fecha de baja
   - Deja de generar obligaciones futuras

**Validaciones:**
- ✅ Un afiliado solo puede tener un coseguro activo
- ✅ Precio se calcula con reglas vigentes al período
- ❌ **Falta**: Validar edad máxima de hijos (21 años)
- ❌ **Falta**: Bloqueo automático por falta de pago

---

## 5. LIMITACIONES ACTUALES

### 🚫 5.1 FUNCIONALIDADES FALTANTES CRÍTICAS

1. **Reportes**: No hay módulo de reportes (morosidad, cobranza, estadísticas)
2. **Auditoría**: No hay log de cambios por usuario (solo login tracking)
3. **Notificaciones**: No hay emails/SMS/WhatsApp
4. **Workflows**: No hay aprobaciones (órdenes, facturas, ajustes)
5. **Dashboards**: No hay visualizaciones (gráficos, indicadores KPI)
6. **Backup/Restore**: No hay UI para backups
7. **Multi-idioma**: Solo español
8. **Mobile**: No hay app móvil nativa
9. **Offline**: No funciona sin conexión
10. **Help/Docs**: No hay sistema de ayuda contextual

---

### 🚫 5.2 INTEGRACIONES FALTANTES

1. **AFIP**: No hay validación de CUIT, constancia inscripción, factura electrónica
2. **Bancos**: No hay conciliación bancaria, home banking
3. **Tarjetas**: No hay integración con POS/gateways
4. **Email**: No hay envío automático de comprobantes
5. **WhatsApp**: No hay notificaciones
6. **SMS**: No hay alertas
7. **Contabilidad**: No hay integración con Tango/Bejerman/otros
8. **BI**: No hay conexión con Power BI/Tableau

---

### 🚫 5.3 VALIDACIONES FALTANTES

1. **Negocio**:
   - Cupo disponible antes de orden de crédito
   - Edad máxima colaterales
   - Duplicados de afiliados (nombre/apellido)
   - Formato de archivos de nómina

2. **Técnicas**:
   - CUIT válido (dígito verificador)
   - CBU válido
   - Formato de email
   - Formato de teléfono

3. **Seguridad**:
   - Contraseñas débiles (longitud, complejidad)
   - Rate limiting (intentos de login)
   - CORS configurado correctamente
   - Headers de seguridad (CSP, HSTS)

---

## 6. ROADMAP FUNCIONAL

### 📅 6.1 CORTO PLAZO (1-2 meses)

**Prioridad ALTA:**
1. ✅ Completar conciliación de nómina (implementado)
2. ⏳ Módulo de reportes básicos (morosidad, cobranza)
3. ⏳ Impresión automática de recibos en caja
4. ⏳ Validaciones de negocio críticas (cupo, edad)
5. ⏳ Auditoría de cambios (quién modificó qué)

**Prioridad MEDIA:**
6. ⏳ Dashboard con KPIs principales
7. ⏳ Exportación de reportes a Excel
8. ⏳ Notificaciones por email (comprobantes)
9. ⏳ Workflow de aprobación de órdenes
10. ⏳ Anulación de operaciones (con auditoría)

---

### 📅 6.2 MEDIANO PLAZO (3-6 meses)

**Funcionalidades:**
1. ⏳ Integración AFIP (validación CUIT, factura electrónica)
2. ⏳ Conciliación bancaria
3. ⏳ Libros contables (Diario, Mayor, IVA)
4. ⏳ Cierre de ejercicio
5. ⏳ Planes de financiación (refinanciación)
6. ⏳ Gestión de cheques
7. ⏳ Scoring crediticio
8. ⏳ App móvil para operadores

---

### 📅 6.3 LARGO PLAZO (6-12 meses)

**Expansión:**
1. ⏳ Portal del afiliado (self-service)
2. ⏳ Firma digital
3. ⏳ Integración con sistemas contables externos
4. ⏳ BI/Analytics avanzado
5. ⏳ Gestión de autorizaciones médicas
6. ⏳ Registro de prestaciones
7. ⏳ Liquidación de prestadores
8. ⏳ Multi-moneda completo (no solo ARS/USD)

---

## 📊 RESUMEN EJECUTIVO

| Módulo | Estado | Funcionalidad Core | Limitaciones Principales |
|--------|--------|-------------------|-------------------------|
| **Auth** | ✅ 95% | Login, roles, sesiones | Sin 2FA, sin recuperación password |
| **Afiliados** | ✅ 90% | CRUD completo, búsqueda | Sin importación masiva, sin historial |
| **Padrones** | ✅ 85% | CRUD completo | Sin importación, sin validaciones |
| **Caja** | ✅ 85% | Cobro, cierre, asientos | Sin impresión recibo, sin arqueo |
| **Obligaciones** | ✅ 80% | CRUD, tracking nómina | Sin generación automática periódica |
| **Órdenes** | ✅ 80% | Preview, cuotas, materialización | Sin workflow aprobación, sin cupo |
| **Coseguro** | ✅ 90% | Alta/baja, colaterales, precios | Sin validación edad, sin bloqueo mora |
| **Nómina** | ✅ 85% | Generación, conciliación | Sin validación formato, sin notificaciones |
| **Contabilidad** | ✅ 70% | Plan, mapeos, asientos auto | Sin libros, sin balance, sin cierre |
| **Terceros** | ✅ 85% | CRUD, cuentas, comprobantes, OP | Sin AFIP, sin factura electrónica |
| **Impresión** | ✅ 75% | Comprobantes PDF | Sin impresión directa, sin email |
| **Movimientos** | ✅ 90% | Cuenta corriente completa | Sin reportes morosidad, sin scoring |
| **Reportes** | ❌ 0% | **NO IMPLEMENTADO** | - |
| **Auditoría** | ⚠️ 20% | Solo login tracking | Sin log de cambios de datos |
| **Notificaciones** | ❌ 0% | **NO IMPLEMENTADO** | - |

**Leyenda:**
- ✅ Implementado y funcional
- ⚠️ Parcialmente implementado
- ❌ No implementado
- ⏳ Pendiente/Planificado

---

## 🎯 CONCLUSIONES

### Fortalezas del sistema:
1. ✅ Base sólida de datos (schema completo y normalizado)
2. ✅ Multitenancy robusto
3. ✅ Flujos críticos funcionando (caja, nómina, órdenes)
4. ✅ Integración contable automática
5. ✅ Trazabilidad completa de operaciones

### Áreas de mejora prioritarias:
1. 📊 Reportes y dashboards
2. 🔔 Notificaciones (email/WhatsApp)
3. ✅ Validaciones de negocio
4. 📝 Auditoría completa
5. 🔌 Integraciones externas (AFIP, bancos)

### Próximos pasos recomendados:
1. Implementar módulo de reportes básicos
2. Agregar validaciones de negocio faltantes
3. Completar auditoría de cambios
4. Desarrollar dashboard principal
5. Integrar impresión automática en caja

---

**Documento generado automáticamente**  
**Fecha:** 26/11/2025  
**Versión del sistema:** Sprint 3 completado  
**Próxima revisión:** Al finalizar Sprint 4
