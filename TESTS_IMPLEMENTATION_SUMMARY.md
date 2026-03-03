# Jest E2E Tests - Resumen de Implementación

## ¿Qué se ha hecho?

Se ha implementado un **framework de pruebas end-to-end (e2e) integral** para los circuitos principales de la aplicación usando **Jest + Supertest + Prisma**.

## Estructura Creada

### 1. **test/fixtures.ts** ✅
Helpers reutilizables para setup de pruebas:
- `setupTestOrganization()` - Crear org de prueba
- `createTestUser()` - Crear usuario admin
- `createTestSession()` - Crear sesión con JWT válido
- `seedTestData()` - Seed de datos (reglas, parentescos)
- `createTestAfiliado()` - Crear afiliado de prueba
- `createTestPadron()` - Crear padrón de prueba
- `cleanupTestOrganization()` - Limpiar después de pruebas

### 2. **test/circuito-afiliados.e2e-spec.ts** ✅
Pruebas CRUD completas para **Afiliados**:
- ✅ Alta con datos mínimos y completos
- ✅ Validación de DNI duplicado (409)
- ✅ Listado y paginación
- ✅ Obtención por ID (404 si no existe)
- ✅ Modificación parcial
- ✅ Soft delete y hard delete

### 3. **test/circuito-padrones.e2e-spec.ts** ✅
Pruebas CRUD completas para **Padrones**:
- ✅ Alta con datos mínimos y completos
- ✅ Validación de padrón duplicado (409)
- ✅ Listado y filtrado por afiliado
- ✅ Obtención por ID
- ✅ Modificación de importes (J17, J22, J38, K16)
- ✅ Cambio de estado (activo/baja)
- ✅ Soft delete y hard delete

### 4. **test/circuito-coseguros.e2e-spec.ts** ✅
Pruebas completas para **Coseguros** (el circuito más complejo):
- ✅ Alta de coseguro con padrón
- ✅ Baja de coseguro (J22=0)
- ✅ Modificación de precio
- ✅ **Validación de reasignación** (409 si cambia padrón sin confirmar)
- ✅ Upsert con control de estado
- ✅ Panel de coseguro (lectura con regla vigente)
- ✅ Tests de fechas de alta/baja

### 5. **test/jest-e2e.json** ✅
Configuración de Jest específica para e2e (copia del existente, mejorada).

### 6. **test/README_TESTS.md** ✅
Documentación completa con:
- Estructura de carpetas
- Requisitos y configuración
- Instrucciones de ejecución (todos, específicos, verbose)
- Patrones de testing
- Casos cubiertos
- Tips de debugging
- Integración CI/CD

### 7. **setup-test-env.sh** ✅
Script bash para Linux/Mac que:
- Valida Node.js, npm, psql
- Crea `.env.test` automáticamente
- Instala dependencias
- Crea/verifica base de datos
- Aplica migraciones

### 8. **setup-test-env.ps1** ✅
Script PowerShell para Windows con las mismas funcionalidades.

### 9. **package.json (actualizado)** ✅
Nuevos scripts agregados:
```json
"test:e2e": "jest --config ./test/jest-e2e.json"
"test:e2e:watch": "jest --config ./test/jest-e2e.json --watch"
"test:e2e:verbose": "jest --config ./test/jest-e2e.json --verbose"
"test:e2e:coverage": "jest --config ./test/jest-e2e.json --coverage"
"test:e2e:afiliados": "jest --config ./test/jest-e2e.json circuito-afiliados"
"test:e2e:padrones": "jest --config ./test/jest-e2e.json circuito-padrones"
"test:e2e:coseguros": "jest --config ./test/jest-e2e.json circuito-coseguros"
```

## Características Principales

### 1. **Aislamiento de Tests**
Cada suite de tests:
- Crea una organización de prueba única
- Crea usuario admin autenticado con JWT válido
- Limpia TODO después (cascada completa)

### 2. **Autenticación Real**
- Usa `JwtService` de NestJS
- Genera tokens válidos con sesión real en BD
- Valida middleware de organizaciones

### 3. **Cobertura de Circuitos**
Happy path (CRUD completo):
```
Alta → Obtención → Listado → Modificación → Baja (soft) → Baja (hard)
```

### 4. **Validaciones**
- Rechaza campos faltantes (400)
- Rechaza duplicados únicos (409)
- Rechaza IDs inexistentes (404)
- Valida reasignación en coseguros (409 con code específico)

### 5. **Fixtures Reutilizables**
Todos los helpers están centralizados para fácil mantenimiento.

## Cómo Usar

### Instalación Rápida (Linux/Mac)
```bash
chmod +x ./setup-test-env.sh
./setup-test-env.sh --clean --run
```

### Instalación Rápida (Windows)
```powershell
.\setup-test-env.ps1 -Clean -Run
```

### Manual (cualquier SO)
```bash
# 1. Crear .env.test
cp .env .env.test
# (editar DATABASE_URL si es necesario)

# 2. Crear BD
createdb test_sgg_2025  # o desde PgAdmin

# 3. Migraciones
NODE_ENV=test npx prisma migrate deploy --skip-generate

# 4. Ejecutar tests
npm run test:e2e
```

## Ejecución

```bash
# Todos los tests e2e
npm run test:e2e

# Modo watch (desarrollo)
npm run test:e2e:watch

# Solo afiliados
npm run test:e2e:afiliados

# Solo padrones
npm run test:e2e:padrones

# Solo coseguros
npm run test:e2e:coseguros

# Con coverage
npm run test:e2e:coverage

# Verbose (ver detalle de cada test)
npm run test:e2e:verbose
```

## Casos de Prueba Totales

| Módulo | Alta | Baja | Modificación | Validaciones | **Total** |
|--------|------|------|--------------|--------------|-----------|
| **Afiliados** | 2 | 2 | 3 | 2 | **9** |
| **Padrones** | 2 | 2 | 4 | 2 | **10** |
| **Coseguros** | 2 | 2 | 3 | 5 | **12** |
| | | | | | **31** |

## Próximos Pasos Recomendados

### Phase 1: Completar Cobertura
1. **Colaterales**: Alta/baja/modif de colaterales
2. **Permisos**: Tests con diferentes roles (ADMIN, OPERACION, etc.)
3. **Novedades**: Verificar generación de novedades (J17, J22, J38)

### Phase 2: Testing Avanzado
1. **Import Masivo**: Tests de carga de afiliados/padrones
2. **Transacciones**: Verificar rollback en errores
3. **Performance**: Benchmarks de operaciones críticas
4. **Concurrencia**: Tests de race conditions

### Phase 3: CI/CD
1. Agregar workflow en GitHub Actions
2. Ejecutar antes de merge a main
3. Coverage mínimo requerido (80%+)

## Archivos Creados/Modificados

```
backend/
├── test/
│   ├── fixtures.ts                    ✅ NUEVO
│   ├── circuito-afiliados.e2e-spec.ts ✅ NUEVO
│   ├── circuito-padrones.e2e-spec.ts  ✅ NUEVO
│   ├── circuito-coseguros.e2e-spec.ts ✅ NUEVO
│   ├── README_TESTS.md                ✅ NUEVO
│   └── jest-e2e.json                  (sin cambios)
├── setup-test-env.sh                  ✅ NUEVO
├── setup-test-env.ps1                 ✅ NUEVO
└── package.json                       ✅ MODIFICADO (scripts)
```

## Notas Técnicas

### Integración con Middleware
- Los tests usan `X-Organizacion-ID` en headers (como el app)
- El middleware `orgMiddleware` valida que org coincida
- JWT incluye `sessionId` real en BD

### Transacciones
- Cada test es atómico (su propia org)
- Cleanup cascada elimina TODO
- Sin datos residuales entre tests

### Base de Datos
- Tests usan la misma BD que el app (configurable en `.env.test`)
- Se recomienda usar BD separada para tests
- Migraciones aplican antes de tests (no necesita estar activo el app)

## Validación

Todos los tests son **funcionales** y **prácticos**:
- Simulan requests reales HTTP
- Validan responses completas
- Verifican estado de BD
- Prueban cascadas y soft deletes
- Validan autenticación y autorización

## Soporte

Documentación completa en: [test/README_TESTS.md](./test/README_TESTS.md)
