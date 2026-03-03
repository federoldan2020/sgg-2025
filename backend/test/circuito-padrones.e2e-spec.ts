/**
 * test/circuito-padrones.e2e-spec.ts
 * ──────────────────────────────────
 * Pruebas e2e para circuitos CRUD de Padrones:
 * - Alta (POST /padrones)
 * - Baja (DELETE /padrones/:id)
 * - Modificación (PATCH /padrones/:id)
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
  createTestPadron,
  cleanupTestOrganization,
} from './fixtures';
import { PrismaClient } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';

describe('Circuito Padrones (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let jwtService: JwtService;
  let organizacionId: string;
  let usuarioId: bigint;
  let accessToken: string;
  let testAfiliadoId: bigint;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = app.get(PrismaClient);
    jwtService = app.get(JwtService);

    // Setup organización y usuario
    const org = await setupTestOrganization('ORG_TEST_PADRONES');
    organizacionId = org.id;

    const { usuario } = await createTestUser(organizacionId, 'test-padron@example.com');
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

    // Crear un afiliado de prueba para los padrones
    const afiliado = await createTestAfiliado(organizacionId, '99988877');
    testAfiliadoId = afiliado.id;
  });

  afterAll(async () => {
    await cleanupTestOrganization(organizacionId);
    await app.close();
    await prisma.$disconnect();
  });

  describe('POST /padrones - Alta', () => {
    it('debe crear un padrón con datos mínimos', async () => {
      const res = await request(app.getHttpServer())
        .post('/padrones')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('X-Organizacion-ID', organizacionId)
        .send({
          afiliadoId: Number(testAfiliadoId),
          padron: 'P-001',
        })
        .expect(201);

      expect(res.body).toHaveProperty('id');
      expect(res.body.padron).toBe('P-001');
      expect(res.body.afiliadoId).toBe(Number(testAfiliadoId));
    });

    it('debe crear un padrón con datos completos', async () => {
      const res = await request(app.getHttpServer())
        .post('/padrones')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('X-Organizacion-ID', organizacionId)
        .send({
          afiliadoId: Number(testAfiliadoId),
          padron: 'P-002',
          centro: 1,
          sector: 2,
          clase: 'A',
          situacion: 'TITULAR',
          sistema: 'ESC',
          j17: '0.00',
          j22: '3500.00',
          j38: '0.00',
          k16: '0.00',
          cupo: '5000.00',
          saldo: '2000.00',
        })
        .expect(201);

      expect(res.body).toHaveProperty('id');
      expect(res.body.padron).toBe('P-002');
      expect(res.body.centro).toBe(1);
      expect(res.body.sistema).toBe('ESC');
      expect(res.body.j22).toBe('3500.00');
    });

    it('debe rechazar si falta afiliadoId o padron', async () => {
      const res = await request(app.getHttpServer())
        .post('/padrones')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('X-Organizacion-ID', organizacionId)
        .send({
          centro: 1,
        })
        .expect(400);

      expect(res.body.message).toMatch(/afiliadoId|padron/i);
    });

    it('debe rechazar si el padrón ya existe en la organización', async () => {
      // Crear primero
      await request(app.getHttpServer())
        .post('/padrones')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('X-Organizacion-ID', organizacionId)
        .send({
          afiliadoId: Number(testAfiliadoId),
          padron: 'P-DUPL',
        })
        .expect(201);

      // Intentar crear duplicado
      const res = await request(app.getHttpServer())
        .post('/padrones')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('X-Organizacion-ID', organizacionId)
        .send({
          afiliadoId: Number(testAfiliadoId),
          padron: 'P-DUPL',
        })
        .expect(409);

      expect(res.body.message).toContain('padrón');
    });
  });

  describe('GET /padrones - Listar', () => {
    it('debe listar padrones de la organización', async () => {
      const res = await request(app.getHttpServer())
        .get('/padrones')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('X-Organizacion-ID', organizacionId)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
    });

    it('debe filtrar padrones por afiliadoId si se proporciona', async () => {
      const res = await request(app.getHttpServer())
        .get('/padrones')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('X-Organizacion-ID', organizacionId)
        .query({ afiliadoId: Number(testAfiliadoId) })
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      res.body.forEach((p: any) => {
        expect(p.afiliadoId).toBe(Number(testAfiliadoId));
      });
    });
  });

  describe('GET /padrones/:id - Obtener', () => {
    let testPadronId: bigint;

    beforeAll(async () => {
      const padron = await createTestPadron(organizacionId, testAfiliadoId, 'P-GET-TEST');
      testPadronId = padron.id;
    });

    it('debe obtener un padrón por ID', async () => {
      const res = await request(app.getHttpServer())
        .get(`/padrones/${testPadronId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('X-Organizacion-ID', organizacionId)
        .expect(200);

      expect(res.body.id).toBe(Number(testPadronId));
      expect(res.body.padron).toBe('P-GET-TEST');
    });

    it('debe retornar 404 si el padrón no existe', async () => {
      const res = await request(app.getHttpServer())
        .get('/padrones/999999')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('X-Organizacion-ID', organizacionId)
        .expect(404);

      expect(res.body.message).toContain('no encontrado');
    });
  });

  describe('PATCH /padrones/:id - Modificación', () => {
    let testPadronId: bigint;

    beforeAll(async () => {
      const padron = await createTestPadron(organizacionId, testAfiliadoId, 'P-PATCH-TEST');
      testPadronId = padron.id;
    });

    it('debe actualizar datos del padrón', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/padrones/${testPadronId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('X-Organizacion-ID', organizacionId)
        .send({
          j17: '1500.00',
          j22: '4000.00',
          cupo: '6000.00',
        })
        .expect(200);

      expect(res.body.j17).toBe('1500.00');
      expect(res.body.j22).toBe('4000.00');
      expect(res.body.cupo).toBe('6000.00');
    });

    it('debe permitir cambiar el estado (activo/baja)', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/padrones/${testPadronId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('X-Organizacion-ID', organizacionId)
        .send({
          activo: false,
        })
        .expect(200);

      expect(res.body.activo).toBe(false);
    });

    it('debe actualizar parcialmente sin afectar otros campos', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/padrones/${testPadronId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('X-Organizacion-ID', organizacionId)
        .send({
          sector: 5,
        })
        .expect(200);

      expect(res.body.sector).toBe(5);
      expect(res.body.j17).toBe('1500.00'); // debe mantenerse
    });

    it('debe permitir agregar fecha de baja', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/padrones/${testPadronId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('X-Organizacion-ID', organizacionId)
        .send({
          fechaBaja: '2025-02-01',
          activo: false,
        })
        .expect(200);

      expect(res.body.fechaBaja).toEqual(expect.stringContaining('2025-02-01'));
      expect(res.body.activo).toBe(false);
    });
  });

  describe('DELETE /padrones/:id - Baja', () => {
    let testPadronId: bigint;

    beforeAll(async () => {
      const padron = await createTestPadron(organizacionId, testAfiliadoId, 'P-DELETE-TEST');
      testPadronId = padron.id;
    });

    it('debe hacer soft delete (marcar como inactivo)', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/padrones/${testPadronId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('X-Organizacion-ID', organizacionId)
        .send({ hard: false })
        .expect(200);

      expect(res.body.activo).toBe(false);

      // Verificar que sigue existiendo
      const check = await request(app.getHttpServer())
        .get(`/padrones/${testPadronId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('X-Organizacion-ID', organizacionId)
        .expect(200);

      expect(check.body.activo).toBe(false);
    });

    it('debe permitir hard delete si se especifica', async () => {
      const padron = await createTestPadron(organizacionId, testAfiliadoId, 'P-HARDEL');
      const hardDelId = padron.id;

      await request(app.getHttpServer())
        .delete(`/padrones/${hardDelId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('X-Organizacion-ID', organizacionId)
        .query({ hard: 'true' })
        .expect(200);

      // Verificar que ya no existe
      await request(app.getHttpServer())
        .get(`/padrones/${hardDelId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('X-Organizacion-ID', organizacionId)
        .expect(404);
    });
  });
});
