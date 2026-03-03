# Guía: Cómo Extender los Tests a Otros Módulos

Este documento explica cómo agregar pruebas e2e a otros módulos (Colaterales, Terceros, Reintegros, etc.).

## Patrón General

### 1. Crear el archivo de test
Crear `test/circuito-<nombre>.e2e-spec.ts`

```typescript
import { Test, TestingModule } from '@nestjs/testing'
import { INestApplication } from '@nestjs/common'
import * as request from 'supertest'
import { AppModule } from '../src/app.module'
import { 
  setupTestOrganization,
  createTestUser,
  createTestSession,
  seedTestData,
  cleanupTestOrganization,
} from './fixtures'
import { PrismaClient } from '@prisma/client'
import { JwtService } from '@nestjs/jwt'

describe('Circuito <Nombre> (e2e)', () => {
  let app: INestApplication
  let prisma: PrismaClient
  let jwtService: JwtService
  let organizacionId: string
  let usuarioId: bigint
  let accessToken: string

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()

    app = moduleFixture.createNestApplication()
    await app.init()

    prisma = app.get(PrismaClient)
    jwtService = app.get(JwtService)

    // Setup
    const org = await setupTestOrganization('ORG_TEST_<NOMBRE>')
    organizacionId = org.id

    const { usuario } = await createTestUser(organizacionId)
    usuarioId = usuario.id

    const sesion = await createTestSession(usuarioId, organizacionId)
    const payload = {
      sub: usuarioId.toString(),
      email: usuario.email,
      organizacionId,
      roles: usuario.roles,
      sessionId: sesion.id,
      tokenFamily: sesion.tokenFamily,
    }
    accessToken = jwtService.sign(payload)

    await seedTestData(organizacionId)
  })

  afterAll(async () => {
    await cleanupTestOrganization(organizacionId)
    await app.close()
    await prisma.$disconnect()
  })

  describe('POST /endpoint - Alta', () => {
    it('debe crear recurso con datos mínimos', async () => {
      const res = await request(app.getHttpServer())
        .post('/endpoint')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('X-Organizacion-ID', organizacionId)
        .send({
          // datos mínimos requeridos
        })
        .expect(201)

      expect(res.body).toHaveProperty('id')
    })
  })
})
```

### 2. Helpers Comunes

Si necesitas helpers específicos para tu módulo, extender `fixtures.ts`:

```typescript
// En test/fixtures.ts, agregar:

export async function createTestColateral(
  organizacionId: string,
  afiliadoId: bigint,
  parentescoId: bigint,
  nombre = 'Colateral Test'
) {
  const colateral = await prisma.colateral.create({
    data: {
      organizacionId,
      afiliadoId,
      parentescoId,
      nombre,
      activo: true,
    },
  })
  return colateral
}

export async function createTestTercero(
  organizacionId: string,
  nombre = 'Tercero Test',
  tipoPersoneria = 'FÍSICA'
) {
  const tercero = await prisma.tercero.create({
    data: {
      organizacionId,
      nombre,
      tipoPersoneria,
    },
  })
  return tercero
}

// etc...
```

### 3. Patrón de Tests para CRUD

```typescript
describe('GET /endpoint/:id - Obtener', () => {
  let testId: bigint

  beforeAll(async () => {
    // Crear recurso de prueba
    const item = await prisma.modelo.create({ ... })
    testId = item.id
  })

  it('debe obtener por ID', async () => {
    const res = await request(app.getHttpServer())
      .get(`/endpoint/${testId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('X-Organizacion-ID', organizacionId)
      .expect(200)

    expect(res.body.id).toBe(Number(testId))
  })

  it('debe retornar 404 si no existe', async () => {
    const res = await request(app.getHttpServer())
      .get('/endpoint/999999')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('X-Organizacion-ID', organizacionId)
      .expect(404)

    expect(res.body.message).toContain('no encontrado')
  })
})

describe('PATCH /endpoint/:id - Modificación', () => {
  let testId: bigint

  beforeAll(async () => {
    const item = await prisma.modelo.create({ ... })
    testId = item.id
  })

  it('debe actualizar campos', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/endpoint/${testId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('X-Organizacion-ID', organizacionId)
      .send({
        campo: 'nuevo valor',
      })
      .expect(200)

    expect(res.body.campo).toBe('nuevo valor')
  })
})

describe('DELETE /endpoint/:id - Baja', () => {
  let testId: bigint

  beforeAll(async () => {
    const item = await prisma.modelo.create({ ... })
    testId = item.id
  })

  it('debe hacer soft delete', async () => {
    const res = await request(app.getHttpServer())
      .delete(`/endpoint/${testId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('X-Organizacion-ID', organizacionId)
      .send({ hard: false })
      .expect(200)

    expect(res.body.activo).toBe(false)
  })
})
```

## Ejemplos por Módulo

### Colaterales

```typescript
describe('Circuito Colaterales (e2e)', () => {
  // setup...

  describe('POST /colaterales - Alta', () => {
    it('debe crear colateral', async () => {
      const afiliado = await createTestAfiliado(organizacionId)
      const coseguro = await createTestCoseguro(organizacionId, afiliado.id)
      const parentesco = await createTestParentesco(organizacionId)

      const res = await request(app.getHttpServer())
        .post('/colaterales')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('X-Organizacion-ID', organizacionId)
        .send({
          coseguroId: Number(coseguro.id),
          parentescoId: Number(parentesco.id),
          nombre: 'Juan Pérez',
          dni: '12345678',
          activo: true,
        })
        .expect(201)

      expect(res.body.nombre).toBe('Juan Pérez')
    })
  })
})
```

### Terceros

```typescript
describe('Circuito Terceros (e2e)', () => {
  // setup...

  describe('POST /terceros - Alta', () => {
    it('debe crear tercero', async () => {
      const res = await request(app.getHttpServer())
        .post('/terceros')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('X-Organizacion-ID', organizacionId)
        .send({
          nombre: 'Proveedor XYZ',
          tipoPersoneria: 'JURÍDICA',
          cuit: '30-12345678-9',
        })
        .expect(201)

      expect(res.body.nombre).toBe('Proveedor XYZ')
    })
  })
})
```

### Reintegros

```typescript
describe('Circuito Reintegros (e2e)', () => {
  // setup...

  describe('POST /reintegros - Presentar', () => {
    it('debe crear solicitud de reintegro', async () => {
      const afiliado = await createTestAfiliado(organizacionId)
      const colateral = await createTestColateral(organizacionId, afiliado.id)

      const res = await request(app.getHttpServer())
        .post('/reintegros')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('X-Organizacion-ID', organizacionId)
        .send({
          colateralId: Number(colateral.id),
          tipo: 'MEDICAMENTO',
          importe: '500.00',
          descripcion: 'Medicamentos varios',
        })
        .expect(201)

      expect(res.body.estado).toBe('BORRADOR')
    })
  })

  describe('POST /reintegros/:id/presentar - Flujo', () => {
    it('debe cambiar de BORRADOR a PRESENTADO', async () => {
      // Crear reintegro
      const reintegro = await createTestReintegro(organizacionId)

      // Presentar
      const res = await request(app.getHttpServer())
        .post(`/reintegros/${reintegro.id}/presentar`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('X-Organizacion-ID', organizacionId)
        .send({})
        .expect(200)

      expect(res.body.estado).toBe('PRESENTADO')
    })
  })
})
```

### Novedades

```typescript
describe('Circuito Novedades (e2e)', () => {
  // setup...

  describe('GET /novedades - Listar', () => {
    it('debe listar novedades', async () => {
      const res = await request(app.getHttpServer())
        .get('/novedades')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('X-Organizacion-ID', organizacionId)
        .expect(200)

      expect(Array.isArray(res.body)).toBe(true)
    })
  })

  describe('POST /novedades/:id/procesar - Procesar', () => {
    it('debe procesar novedad', async () => {
      const novedad = await prisma.novedadPendiente.findFirst({
        where: { organizacionId },
      })

      const res = await request(app.getHttpServer())
        .post(`/novedades/${novedad?.id}/procesar`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('X-Organizacion-ID', organizacionId)
        .send({})
        .expect(200)

      expect(res.body.estado).toBe('PROCESADO')
    })
  })
})
```

## Checklist para Agregar Tests a un Módulo

- [ ] Crear `test/circuito-<nombre>.e2e-spec.ts`
- [ ] Importar fixtures necesarias
- [ ] Crear setup (beforeAll)
- [ ] Crear cleanup (afterAll)
- [ ] Tests de GET (obtener, listar)
- [ ] Tests de POST (crear, validaciones)
- [ ] Tests de PATCH (actualizar)
- [ ] Tests de DELETE (eliminar)
- [ ] Tests de casos de error (400, 404, 409)
- [ ] Tests de flujos especiales (cambios de estado, reasignaciones)
- [ ] Agregar helpers en `fixtures.ts` si es necesario
- [ ] Documentar en `test/README_TESTS.md`
- [ ] Agregar script en `package.json`

## Script en package.json

```json
"test:e2e:colaterales": "jest --config ./test/jest-e2e.json circuito-colaterales",
"test:e2e:terceros": "jest --config ./test/jest-e2e.json circuito-terceros",
"test:e2e:reintegros": "jest --config ./test/jest-e2e.json circuito-reintegros",
"test:e2e:novedades": "jest --config ./test/jest-e2e.json circuito-novedades",
```

## Validación de Tests Nuevos

```bash
# Ejecutar módulo específico
npm run test:e2e:colaterales

# Ver cobertura
npm run test:e2e:coverage

# Verbose
npm run test:e2e:verbose -- circuito-colaterales
```

## Casos Especiales

### Flujos Multi-paso

Si el módulo tiene un flujo (ej. BORRADOR → PRESENTADO → APROBADO):

```typescript
describe('Flujo de Estados', () => {
  it('debe seguir transiciones válidas', async () => {
    // 1. Crear en BORRADOR
    const res1 = await request(...).post(...).expect(201)
    const id = res1.body.id

    // 2. Cambiar a PRESENTADO
    const res2 = await request(...).post(`.../${id}/presentar`).expect(200)
    expect(res2.body.estado).toBe('PRESENTADO')

    // 3. Cambiar a APROBADO
    const res3 = await request(...).post(`.../${id}/aprobar`).expect(200)
    expect(res3.body.estado).toBe('APROBADO')
  })

  it('debe rechazar transiciones inválidas', async () => {
    const res = await request(...).post(`.../${id}/rechazar`).expect(400)
    expect(res.body.message).toContain('no puede rechazarse desde')
  })
})
```

### Datos Relacionados

Si necesitas crear datos en cascada:

```typescript
export async function createTestReintegroCompleto(organizacionId: string) {
  const afiliado = await createTestAfiliado(organizacionId)
  const padron = await createTestPadron(organizacionId, afiliado.id)
  const coseguro = await prisma.coseguroAfiliado.create({
    data: { organizacionId, afiliadoId: afiliado.id, fechaAlta: new Date() },
  })
  const parentesco = await createTestParentesco(organizacionId)
  const colateral = await createTestColateral(
    organizacionId,
    afiliado.id,
    parentesco.id
  )
  const reintegro = await prisma.reintegroSolicitud.create({
    data: {
      organizacionId,
      colateralId: colateral.id,
      tipo: 'MEDICAMENTO',
      estado: 'BORRADOR',
    },
  })
  return { afiliado, padron, coseguro, colateral, reintegro }
}
```

## Preguntas Frecuentes

**P: ¿Necesito hacer seed de datos para cada test?**
R: No, usa fixtures. Solo crea los datos que necesites específicamente.

**P: ¿Cómo testeo permisos por rol?**
R: Crea usuarios con diferentes roles en fixtures, genera tokens distintos.

**P: ¿Qué hago si un test es muy largo?**
R: Divide en varios tests más pequeños, reutiliza fixtures.

**P: ¿Se pueden ejecutar tests en paralelo?**
R: Sí, Jest lo hace automático si cada test usa su propia org.

**P: ¿Cómo debuggeo un test que falla?**
R: Usa `it.only()` para aislarlo, agrega `console.log()`, usa `test:e2e:verbose`.
