# Jest E2E Tests - Circuitos de Negocio

Esta carpeta contiene las pruebas end-to-end (e2e) para los circuitos principales de la aplicación:

- **Afiliados**: Alta, Baja, Modificación
- **Padrones**: Alta, Baja, Modificación
- **Coseguros**: Alta, Baja, Modificación, Validación de Reasignación

## Estructura

```
test/
├── fixtures.ts                          # Helpers de setup (BD, usuarios, JWT)
├── circuito-afiliados.e2e-spec.ts      # Tests CRUD de Afiliados
├── circuito-padrones.e2e-spec.ts       # Tests CRUD de Padrones
├── circuito-coseguros.e2e-spec.ts      # Tests CRUD de Coseguros
├── jest-e2e.json                        # Configuración de Jest para e2e
└── app.e2e-spec.ts                      # Smoke test (mantener)
```

## Requisitos

- Node.js 18+
- Base de datos Postgresql (URL en `.env.test`)
- Jest y supertest instalados (ver `package.json`)

## Configuración

### Variables de Entorno

Crear `.env.test` (o usar `.env` con override):

```bash
NODE_ENV=test
DATABASE_URL=postgresql://user:password@localhost:5432/test_db
JWT_SECRET=test-secret-key
```

### Base de Datos

Ejecutar las migraciones en la BD de test:

```bash
# Crear BD test (si no existe)
createdb test_db

# Ejecutar migraciones Prisma
npx prisma migrate deploy --skip-generate
```

## Ejecución

### Todos los tests e2e
```bash
npm run test:e2e
```

### Tests específicos
```bash
# Solo Afiliados
npx jest --config ./test/jest-e2e.json circuito-afiliados

# Solo Padrones
npx jest --config ./test/jest-e2e.json circuito-padrones

# Solo Coseguros
npx jest --config ./test/jest-e2e.json circuito-coseguros
```

### Con output verbose
```bash
npm run test:e2e -- --verbose
```

### Con coverage
```bash
npx jest --config ./test/jest-e2e.json --coverage
```

## Flujo de Ejecución

Cada suite de tests:

1. **Setup** (`beforeAll`):
   - Crea organización de prueba
   - Crea usuario admin con JWT válido
   - Seed de datos iniciales (reglas, parentescos, etc.)

2. **Tests** (describe/it):
   - Hace requests HTTP reales contra la app
   - Verifica responses y estado de BD

3. **Teardown** (`afterAll`):
   - Elimina organización (cascada)
   - Cierra conexión con BD

## Fixtures Principales

### `setupTestOrganization(name?)`
Crea una nueva organización de prueba (limpia la anterior si existe).

### `createTestUser(orgId, email, password)`
Crea un usuario admin autenticado.

### `createTestSession(usuarioId, orgId)`
Crea una sesión y retorna objeto necesario para firmar JWT.

### `seedTestData(orgId)`
Crea reglas de coseguro, parentescos y otros datos iniciales.

### `createTestAfiliado(orgId, dni, nombre?, apellido?)`
Crea un afiliado de prueba.

### `createTestPadron(orgId, afiliadoId, padronCode?, centro?, sistema?)`
Crea un padrón de prueba.

## Patrones de Test

### Circuito Happy Path (Alta → Modificación → Baja)

```typescript
it('debe crear, actualizar y eliminar un recurso', async () => {
  // Alta
  const alta = await request(app.getHttpServer())
    .post('/recurso')
    .set('Authorization', `Bearer ${accessToken}`)
    .set('X-Organizacion-ID', organizacionId)
    .send({ ...data })
    .expect(201);
  
  const id = alta.body.id;

  // Modificación
  const patch = await request(app.getHttpServer())
    .patch(`/recurso/${id}`)
    .set('Authorization', `Bearer ${accessToken}`)
    .set('X-Organizacion-ID', organizacionId)
    .send({ ...updates })
    .expect(200);

  // Baja
  const del = await request(app.getHttpServer())
    .delete(`/recurso/${id}`)
    .set('Authorization', `Bearer ${accessToken}`)
    .set('X-Organizacion-ID', organizacionId)
    .expect(200);
});
```

### Validaciones y Errores

```typescript
it('debe rechazar si falta campo requerido', async () => {
  const res = await request(app.getHttpServer())
    .post('/recurso')
    .set('Authorization', `Bearer ${accessToken}`)
    .set('X-Organizacion-ID', organizacionId)
    .send({ /* faltan campos */ })
    .expect(400);
  
  expect(res.body.message).toContain('campo');
});
```

## Casos de Test Cubiertos

### Afiliados
- ✅ Alta con datos mínimos
- ✅ Alta con datos completos
- ✅ Rechazo por DNI duplicado
- ✅ Obtención y listado
- ✅ Modificación parcial
- ✅ Soft delete y hard delete

### Padrones
- ✅ Alta con datos mínimos y completos
- ✅ Rechazo por padrón duplicado
- ✅ Listado y filtrado por afiliado
- ✅ Modificación de importes (J17, J22, etc.)
- ✅ Cambio de estado (activo/baja)
- ✅ Soft delete y hard delete

### Coseguros
- ✅ Alta de coseguro
- ✅ Baja de coseguro
- ✅ Modificación de precio
- ✅ Validación de reasignación (409 si no confirma)
- ✅ Upsert con control de estado
- ✅ Panel de coseguro (lectura)

## Tips de Debugging

### Ver logs del app
```bash
npm run test:e2e -- --verbose
```

### Pausar en un test específico
```typescript
it.only('debe...', async () => {
  // solo este test ejecuta
});
```

### Ver estado de BD después de un test
```typescript
afterEach(async () => {
  const afiliados = await prisma.afiliado.findMany();
  console.log(afiliados);
});
```

### Resetear BD entre tests
```typescript
beforeEach(async () => {
  await prisma.organizacion.deleteMany(); // ⚠️ cuidado!
});
```

## Integración CI/CD

Para agregar a GitHub Actions (`.github/workflows/test.yml`):

```yaml
name: E2E Tests

on: [push, pull_request]

jobs:
  e2e:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: test_db
        options: >-
          --health-cmd pg_isready --health-interval 10s --health-timeout 5s --health-retries 5
        ports:
          - 5432:5432
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - run: npm ci
      - run: npx prisma migrate deploy --skip-generate
      - run: npm run test:e2e
```

## Next Steps

1. **Parametrización**: Agregar más casos de error (validaciones, permisos, etc.)
2. **Colaterales**: Tests de alta/baja/modif de colaterales
3. **Novedades**: Verificar que se generan novedades correctas (J17, J22, J38)
4. **Permisos**: Tests con diferentes roles (ADMIN, OPERACION, etc.)
5. **Datos Masivos**: Tests de import de afiliados/padrones
6. **Performance**: Benchmarks de operaciones críticas
