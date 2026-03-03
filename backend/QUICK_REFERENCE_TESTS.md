# Jest E2E Tests - Guía Rápida

## Setup (primero, una sola vez)

```bash
# Linux/Mac
chmod +x ./setup-test-env.sh
./setup-test-env.sh --clean

# Windows
.\setup-test-env.ps1 -Clean

# Manual
NODE_ENV=test npx prisma migrate deploy --skip-generate
```

## Ejecutar Tests

```bash
# Todos
npm run test:e2e

# Específicos
npm run test:e2e:afiliados
npm run test:e2e:padrones
npm run test:e2e:coseguros

# Con watch (reload automático en cambios)
npm run test:e2e:watch

# Con detalle
npm run test:e2e:verbose

# Con coverage
npm run test:e2e:coverage
```

## Estructura de Test

```typescript
describe('Módulo (e2e)', () => {
  // Setup global (BD, usuario, tokens)
  beforeAll(async () => { ... })
  
  // Limpiar después
  afterAll(async () => { ... })

  describe('Acción específica', () => {
    it('debe hacer algo', async () => {
      const res = await request(app.getHttpServer())
        .post('/endpoint')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('X-Organizacion-ID', organizacionId)
        .send({ data })
        .expect(201)
      
      expect(res.body).toHaveProperty('id')
    })
  })
})
```

## Headers Obligatorios

```typescript
// Todas las requests necesitan:
.set('Authorization', `Bearer ${accessToken}`)        // JWT válido
.set('X-Organizacion-ID', organizacionId)             // Org del usuario
```

## Fixtures Útiles

```typescript
// En fixtures.ts disponibles:
setupTestOrganization()        // Nueva org de prueba
createTestUser()               // Usuario admin con password
createTestSession()            // Sesión + JWT
seedTestData()                 // Reglas, parentescos
createTestAfiliado()           // Afiliado
createTestPadron()             // Padrón
cleanupTestOrganization()      // Limpiar después
```

## HTTP Status Codes Esperados

| Operación | Success | Fallo | Descripción |
|-----------|---------|-------|-------------|
| POST (crear) | 201 | 400, 409 | 409 = duplicate |
| GET (leer) | 200 | 404 | 404 = no existe |
| PATCH (modificar) | 200 | 400, 404 | 404 = no existe |
| DELETE (eliminar) | 200 | 404 | 404 = no existe |
| Reasignación J22 | 200 | 409 | 409 code='REQUIERE_REASIGNACION_J22' |

## Casos de Error Comunes

```bash
# Error: "no se puede conectar a BD"
→ Verificar que PostgreSQL está corriendo
→ Verificar DATABASE_URL en .env.test

# Error: "Connection refused"
→ Ejecutar: NODE_ENV=test npx prisma migrate deploy

# Error: "X-Organizacion-ID requerido"
→ Agregar header: .set('X-Organizacion-ID', organizacionId)

# Error: "Unauthorized"
→ Verificar que accessToken es válido
→ Tokens JWT duran 15 minutos
```

## Debugging

```typescript
// Ver request que se envía
console.log('Request:', { method, url, headers, body })

// Ver response completa
console.log('Response:', res.status, res.body)

// Pausar en un test
it.only('debug test', async () => { ... })

// Ver logs de BD
afterEach(async () => {
  const data = await prisma.afiliado.findMany()
  console.log('Afiliados:', data)
})

// Log in fixture
console.log('Setup:', { organizacionId, usuarioId, accessToken })
```

## Mejores Prácticas

✅ **Haz**
- Usar fixtures para setup común
- Limpiar después (afterAll)
- Probar happy path + errores principales
- Usar valores de prueba realistas
- Documentar qué valida cada test

❌ **No hagas**
- Tests interdependientes
- Dejar datos sucios
- Hardcodear IDs
- Ignorar status codes
- Hacer tests muy largos (>20 líneas)

## Ejemplo Completo

```typescript
describe('POST /afiliados - Alta', () => {
  let organizacionId: string
  let accessToken: string

  beforeAll(async () => {
    const org = await setupTestOrganization('TEST')
    organizacionId = org.id

    const { usuario } = await createTestUser(organizacionId)
    const sesion = await createTestSession(usuario.id, organizacionId)
    
    const payload = { 
      sub: usuario.id.toString(), 
      sessionId: sesion.id, 
      // ...
    }
    accessToken = jwtService.sign(payload)
  })

  afterAll(async () => {
    await cleanupTestOrganization(organizacionId)
  })

  it('debe crear afiliado', async () => {
    const res = await request(app.getHttpServer())
      .post('/afiliados')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('X-Organizacion-ID', organizacionId)
      .send({
        dni: 12345678,
        apellido: 'López',
        nombre: 'María'
      })
      .expect(201)

    expect(res.body.id).toBeDefined()
    expect(res.body.dni).toBe(12345678)
  })

  it('debe rechazar DNI duplicado', async () => {
    const res = await request(app.getHttpServer())
      .post('/afiliados')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('X-Organizacion-ID', organizacionId)
      .send({
        dni: 12345678, // igual que anterior
        apellido: 'Otro',
        nombre: 'Test'
      })
      .expect(409)

    expect(res.body.message).toContain('DNI')
  })
})
```

## CI/CD Integration

Para GitHub Actions (`.github/workflows/test.yml`):

```yaml
jobs:
  e2e:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env: { POSTGRES_PASSWORD: postgres }
        options: >-
          --health-cmd pg_isready --health-interval 10s
        ports: [5432:5432]
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with: { node-version: 18 }
      - run: npm ci
      - run: npm run test:e2e
```

## Recursos

- [Jest Docs](https://jestjs.io/)
- [Supertest](https://github.com/visionmedia/supertest)
- [NestJS Testing](https://docs.nestjs.com/fundamentals/testing)
- [test/README_TESTS.md](./test/README_TESTS.md) - Documentación completa
