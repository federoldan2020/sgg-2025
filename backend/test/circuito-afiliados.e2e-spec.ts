/**
 * test/circuito-afiliados.e2e-spec.ts
 * ───────────────────────────────────
 * Pruebas e2e para circuitos CRUD de Afiliados:
 * - Alta (POST /afiliados)
 * - Baja (DELETE /afiliados/:id)
 * - Modificación (PATCH /afiliados/:id)
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import {
  setupTestOrganization,
  createTestUser,
  createTestSession,
  seedTestData,
  createTestAfiliado,
  cleanupTestOrganization,
} from './fixtures';
import { PrismaClient } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';

describe('Circuito Afiliados (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let jwtService: JwtService;
  let organizacionId: string;
  let usuarioId: bigint;
  let accessToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = app.get(PrismaClient);
    jwtService = app.get(JwtService);

    // Setup organización y usuario
    const org = await setupTestOrganization('ORG_TEST_AFILIADOS');
    organizacionId = org.id;

    const { usuario } = await createTestUser(organizacionId, 'test-afiliad@example.com');
    usuarioId = usuario.id;

    // Crear sesión y JWT
    const sesion = await createTestSession(usuarioId, organizacionId);
    const payload = {
      sub: usuarioId.toString(),
      email: usuario.email,
      organizacionId,
      roles: usuario.roles,
      sessionId: sesion.id,
      tokenFamily: sesion.tokenFamily,
    };
    accessToken = jwtService.sign(payload);

    await seedTestData(organizacionId);
  });

  afterAll(async () => {
    await cleanupTestOrganization(organizacionId);
    await app.close();
    await prisma.$disconnect();
  });

  describe('POST /afiliados - Alta', () => {
    it('debe crear un afiliado con datos mínimos', async () => {
      const res = await request(app.getHttpServer())
        .post('/afiliados')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('X-Organizacion-ID', organizacionId)
        .send({
          dni: 12345678,
          apellido: 'López',
          nombre: 'María',
        })
        .expect(201);

      expect(res.body).toHaveProperty('id');
      expect(res.body.dni).toBe(12345678);
      expect(res.body.apellido).toBe('López');
      expect(res.body.nombre).toBe('María');
    });

    it('debe crear un afiliado con datos completos', async () => {
      const res = await request(app.getHttpServer())
        .post('/afiliados')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('X-Organizacion-ID', organizacionId)
        .send({
          dni: 87654321,
          apellido: 'García',
          nombre: 'Carlos',
          cuit: '20-87654321-2',
          sexo: 'M',
          tipo: 'TITULAR',
          telefono: '2615551234',
          celular: '2615559999',
          calle: 'San Martín',
          numero: '123',
          barrio: 'Centro',
          localidad: 'San Juan',
          fechaNacimiento: '1985-05-15',
          numeroSocio: 'SOC123',
          cupo: '5000.00',
          saldo: '1500.00',
        })
        .expect(201);

      expect(res.body).toHaveProperty('id');
      expect(res.body.cuit).toBe('20-87654321-2');
      expect(res.body.sexo).toBe('M');
      expect(res.body.numeroSocio).toBe('SOC123');
    });

    it('debe rechazar si falta DNI', async () => {
      const res = await request(app.getHttpServer())
        .post('/afiliados')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('X-Organizacion-ID', organizacionId)
        .send({
          apellido: 'Test',
          nombre: 'User',
        })
        .expect(400);

      expect(res.body.message).toContain('dni');
    });

    it('debe rechazar si DNI ya existe en la organización', async () => {
      // Crear primero
      await request(app.getHttpServer())
        .post('/afiliados')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('X-Organizacion-ID', organizacionId)
        .send({
          dni: 99999999,
          apellido: 'Duplic',
          nombre: 'Ado',
        })
        .expect(201);

      // Intentar crear duplicado
      const res = await request(app.getHttpServer())
        .post('/afiliados')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('X-Organizacion-ID', organizacionId)
        .send({
          dni: 99999999,
          apellido: 'Otra',
          nombre: 'Persona',
        })
        .expect(409);

      expect(res.body.message).toContain('DNI');
    });
  });

  describe('GET /afiliados - Listar', () => {
    it('debe listar afiliados de la organización', async () => {
      // Crear un par de afiliados
      await request(app.getHttpServer())
        .post('/afiliados')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('X-Organizacion-ID', organizacionId)
        .send({ dni: 11111111, apellido: 'A', nombre: 'Test1' })
        .expect(201);

      const res = await request(app.getHttpServer())
        .get('/afiliados')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('X-Organizacion-ID', organizacionId)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
    });
  });

  describe('GET /afiliados/:id - Obtener', () => {
    let testAfiliadoId: bigint;

    beforeAll(async () => {
      const afiliado = await createTestAfiliado(organizacionId, '55555555', 'Pedro', 'Rodríguez');
      testAfiliadoId = afiliado.id;
    });

    it('debe obtener un afiliado por ID', async () => {
      const res = await request(app.getHttpServer())
        .get(`/afiliados/${testAfiliadoId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('X-Organizacion-ID', organizacionId)
        .expect(200);

      expect(res.body.id).toBe(Number(testAfiliadoId));
      expect(res.body.apellido).toBe('Rodríguez');
    });

    it('debe retornar 404 si el afiliado no existe', async () => {
      const res = await request(app.getHttpServer())
        .get('/afiliados/999999')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('X-Organizacion-ID', organizacionId)
        .expect(404);

      expect(res.body.message).toContain('no encontrado');
    });
  });

  describe('PATCH /afiliados/:id - Modificación', () => {
    let testAfiliadoId: bigint;

    beforeAll(async () => {
      const afiliado = await createTestAfiliado(organizacionId, '44444444', 'Ana', 'Martínez');
      testAfiliadoId = afiliado.id;
    });

    it('debe actualizar datos del afiliado', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/afiliados/${testAfiliadoId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('X-Organizacion-ID', organizacionId)
        .send({
          celular: '2615551111',
          localidad: 'San Juan Capital',
        })
        .expect(200);

      expect(res.body.celular).toBe('2615551111');
      expect(res.body.localidad).toBe('San Juan Capital');
    });

    it('debe permitir cambiar el estado del afiliado', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/afiliados/${testAfiliadoId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('X-Organizacion-ID', organizacionId)
        .send({
          estado: 'baja',
        })
        .expect(200);

      expect(res.body.estado).toBe('baja');
    });

    it('debe actualizar parcialmente sin afectar otros campos', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/afiliados/${testAfiliadoId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('X-Organizacion-ID', organizacionId)
        .send({
          telefono: '2615552222',
        })
        .expect(200);

      expect(res.body.telefono).toBe('2615552222');
      expect(res.body.nombre).toBe('Ana'); // no debe cambiar
    });
  });

  describe('DELETE /afiliados/:id - Baja', () => {
    let testAfiliadoId: bigint;

    beforeAll(async () => {
      const afiliado = await createTestAfiliado(organizacionId, '33333333', 'Luis', 'Fernández');
      testAfiliadoId = afiliado.id;
    });

    it('debe hacer soft delete (marcar como baja)', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/afiliados/${testAfiliadoId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('X-Organizacion-ID', organizacionId)
        .send({ hard: false })
        .expect(200);

      expect(res.body.estado).toBe('baja');

      // Verificar que sigue existiendo en BD (soft delete)
      const check = await request(app.getHttpServer())
        .get(`/afiliados/${testAfiliadoId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('X-Organizacion-ID', organizacionId)
        .expect(200);

      expect(check.body.estado).toBe('baja');
    });

    it('debe permitir hard delete si se especifica', async () => {
      const afiliado = await createTestAfiliado(organizacionId, '22222222', 'Rosa', 'González');
      const hardDelId = afiliado.id;

      await request(app.getHttpServer())
        .delete(`/afiliados/${hardDelId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('X-Organizacion-ID', organizacionId)
        .query({ hard: 'true' })
        .expect(200);

      // Verificar que ya no existe
      await request(app.getHttpServer())
        .get(`/afiliados/${hardDelId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('X-Organizacion-ID', organizacionId)
        .expect(404);
    });
  });
});
