/**
 * test/circuito-coseguros.e2e-spec.ts
 * ──────────────────────────────────
 * Pruebas e2e para circuitos de Coseguros:
 * - Alta (POST /coseguro/afiliados/:id/alta)
 * - Baja (POST /coseguro/afiliados/:id/baja)
 * - Modificación precio (PATCH /coseguro/afiliados/:id/modificar)
 * - Validación de reasignación de padrón
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

describe('Circuito Coseguros (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let jwtService: JwtService;
  let organizacionId: string;
  let usuarioId: bigint;
  let accessToken: string;
  let testAfiliadoId: bigint;
  let padron1Id: bigint;
  let padron2Id: bigint;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = app.get(PrismaClient);
    jwtService = app.get(JwtService);

    // Setup organización y usuario
    const org = await setupTestOrganization('ORG_TEST_COSEGUROS');
    organizacionId = org.id;

    const { usuario } = await createTestUser(organizacionId, 'test-coseguro@example.com');
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

    // Crear afiliado y padrones de prueba
    const afiliado = await createTestAfiliado(organizacionId, '11223344');
    testAfiliadoId = afiliado.id;

    const p1 = await createTestPadron(organizacionId, testAfiliadoId, 'P-COS-01');
    padron1Id = p1.id;

    const p2 = await createTestPadron(organizacionId, testAfiliadoId, 'P-COS-02');
    padron2Id = p2.id;
  });

  afterAll(async () => {
    await cleanupTestOrganization(organizacionId);
    await app.close();
    await prisma.$disconnect();
  });

  describe('POST /coseguro/afiliados/:id/alta - Alta', () => {
    it('debe crear un coseguro con alta en padrón', async () => {
      const res = await request(app.getHttpServer())
        .post(`/coseguro/afiliados/${testAfiliadoId}/alta`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('X-Organizacion-ID', organizacionId)
        .send({
          padronId: Number(padron1Id),
        })
        .expect(200);

      expect(res.body).toHaveProperty('ok');
      expect(res.body.ok).toBe(true);

      // Verificar en BD
      const cos = await prisma.coseguroAfiliado.findFirst({
        where: { organizacionId, afiliadoId: testAfiliadoId },
      });

      expect(cos).toBeDefined();
      expect(cos?.estado).toBe('activo');
      expect(cos?.imputacionPadronIdCoseguro).toBe(padron1Id);
    });

    it('debe requerir padronId', async () => {
      const afiliado = await createTestAfiliado(organizacionId, '55667788');

      const res = await request(app.getHttpServer())
        .post(`/coseguro/afiliados/${afiliado.id}/alta`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('X-Organizacion-ID', organizacionId)
        .send({})
        .expect(400);

      expect(res.body.message).toContain('padronId');
    });

    it('debe rechazar padrón inactivo', async () => {
      const padronInactivo = await createTestPadron(organizacionId, testAfiliadoId, 'P-INACT');
      await prisma.padron.update({
        where: { id: padronInactivo.id },
        data: { activo: false },
      });

      const afiliado = await createTestAfiliado(organizacionId, '77889900');
      const p = await createTestPadron(organizacionId, afiliado.id, 'P-NEW');

      const res = await request(app.getHttpServer())
        .post(`/coseguro/afiliados/${afiliado.id}/alta`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('X-Organizacion-ID', organizacionId)
        .send({
          padronId: Number(padronInactivo.id),
        })
        .expect(400);

      expect(res.body.message).toContain('padrón');
    });
  });

  describe('POST /coseguro/afiliados/:id/baja - Baja', () => {
    it('debe hacer baja de coseguro (J22=0)', async () => {
      // Primero hacer una alta
      const afiliado = await createTestAfiliado(organizacionId, '44556677');
      const p = await createTestPadron(organizacionId, afiliado.id, 'P-BAJA-TEST');

      await request(app.getHttpServer())
        .post(`/coseguro/afiliados/${afiliado.id}/alta`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('X-Organizacion-ID', organizacionId)
        .send({ padronId: Number(p.id) })
        .expect(200);

      // Ahora hacer baja
      const res = await request(app.getHttpServer())
        .post(`/coseguro/afiliados/${afiliado.id}/baja`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('X-Organizacion-ID', organizacionId)
        .send({})
        .expect(200);

      expect(res.body.ok).toBe(true);

      // Verificar estado en BD
      const cos = await prisma.coseguroAfiliado.findFirst({
        where: { organizacionId, afiliadoId: afiliado.id },
      });

      expect(cos?.estado).toBe('baja');
    });

    it('debe permitir especificar fecha de baja', async () => {
      const afiliado = await createTestAfiliado(organizacionId, '99001122');
      const p = await createTestPadron(organizacionId, afiliado.id, 'P-DATE-BAJA');

      await request(app.getHttpServer())
        .post(`/coseguro/afiliados/${afiliado.id}/alta`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('X-Organizacion-ID', organizacionId)
        .send({ padronId: Number(p.id) })
        .expect(200);

      const res = await request(app.getHttpServer())
        .post(`/coseguro/afiliados/${afiliado.id}/baja`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('X-Organizacion-ID', organizacionId)
        .send({ ocurridoEn: '2025-02-01' })
        .expect(200);

      expect(res.body.ok).toBe(true);
    });
  });

  describe('PATCH /coseguro/afiliados/:id/modificar - Modificación', () => {
    it('debe modificar el precio de coseguro', async () => {
      const afiliado = await createTestAfiliado(organizacionId, '22334455');
      const p = await createTestPadron(organizacionId, afiliado.id, 'P-MODIF-TEST');

      // Hacer alta primero
      await request(app.getHttpServer())
        .post(`/coseguro/afiliados/${afiliado.id}/alta`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('X-Organizacion-ID', organizacionId)
        .send({ padronId: Number(p.id) })
        .expect(200);

      // Modificar precio
      const res = await request(app.getHttpServer())
        .patch(`/coseguro/afiliados/${afiliado.id}/modificar`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('X-Organizacion-ID', organizacionId)
        .send({
          padronId: Number(p.id),
          nuevoPrecio: '5000.00',
        })
        .expect(200);

      expect(res.body.ok).toBe(true);
    });

    it('debe requerir padronId y nuevoPrecio', async () => {
      const afiliado = await createTestAfiliado(organizacionId, '33445566');

      const res = await request(app.getHttpServer())
        .patch(`/coseguro/afiliados/${afiliado.id}/modificar`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('X-Organizacion-ID', organizacionId)
        .send({})
        .expect(400);

      expect(res.body.message).toMatch(/padronId|nuevoPrecio/i);
    });
  });

  describe('POST /coseguro/upsert - Upsert con Validación de Reasignación', () => {
    it('debe crear coseguro desde upsert', async () => {
      const afiliado = await createTestAfiliado(organizacionId, '66778899');
      const p = await createTestPadron(organizacionId, afiliado.id, 'P-UPS-1');

      const res = await request(app.getHttpServer())
        .post('/coseguro/upsert')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('X-Organizacion-ID', organizacionId)
        .send({
          afiliadoId: Number(afiliado.id),
          estado: 'activo',
          padronCoseguroId: Number(p.id),
        })
        .expect(200);

      expect(res.body.estado).toBe('activo');
      expect(res.body.padronCoseguroId).toBe(Number(p.id));
    });

    it('debe actualizar coseguro desde upsert', async () => {
      const afiliado = await createTestAfiliado(organizacionId, '88990011');
      const p1 = await createTestPadron(organizacionId, afiliado.id, 'P-UPS-2A');
      const p2 = await createTestPadron(organizacionId, afiliado.id, 'P-UPS-2B');

      // Crear primero
      await request(app.getHttpServer())
        .post('/coseguro/upsert')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('X-Organizacion-ID', organizacionId)
        .send({
          afiliadoId: Number(afiliado.id),
          estado: 'activo',
          padronCoseguroId: Number(p1.id),
        })
        .expect(200);

      // Actualizar
      const res = await request(app.getHttpServer())
        .post('/coseguro/upsert')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('X-Organizacion-ID', organizacionId)
        .send({
          afiliadoId: Number(afiliado.id),
          estado: 'activo',
          padronCoseguroId: Number(p2.id),
          reasignar: true, // Confirmar reasignación
        })
        .expect(200);

      expect(res.body.estado).toBe('activo');
      expect(res.body.padronCoseguroId).toBe(Number(p2.id));
    });

    it('debe rechazar reasignación sin confirmar', async () => {
      const afiliado = await createTestAfiliado(organizacionId, '00112233');
      const p1 = await createTestPadron(organizacionId, afiliado.id, 'P-UPS-3A');
      const p2 = await createTestPadron(organizacionId, afiliado.id, 'P-UPS-3B');

      // Crear con p1
      await request(app.getHttpServer())
        .post('/coseguro/upsert')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('X-Organizacion-ID', organizacionId)
        .send({
          afiliadoId: Number(afiliado.id),
          estado: 'activo',
          padronCoseguroId: Number(p1.id),
        })
        .expect(200);

      // Intentar cambiar a p2 sin reasignar=true
      const res = await request(app.getHttpServer())
        .post('/coseguro/upsert')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('X-Organizacion-ID', organizacionId)
        .send({
          afiliadoId: Number(afiliado.id),
          estado: 'activo',
          padronCoseguroId: Number(p2.id),
          // reasignar NO viene, o es false
        })
        .expect(409);

      expect(res.body.code).toBe('REQUIERE_REASIGNACION_J22');
      expect(res.body).toHaveProperty('currentPadronId');
      expect(res.body).toHaveProperty('newPadronId');
    });
  });

  describe('GET /coseguro/afiliados/:id - Panel', () => {
    it('debe obtener el panel de coseguro del afiliado', async () => {
      const afiliado = await createTestAfiliado(organizacionId, '12345567');
      const p = await createTestPadron(organizacionId, afiliado.id, 'P-PANEL-1');

      // Hacer alta
      await request(app.getHttpServer())
        .post(`/coseguro/afiliados/${afiliado.id}/alta`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('X-Organizacion-ID', organizacionId)
        .send({ padronId: Number(p.id) })
        .expect(200);

      // Obtener panel
      const res = await request(app.getHttpServer())
        .get(`/coseguro/afiliados/${afiliado.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('X-Organizacion-ID', organizacionId)
        .expect(200);

      expect(res.body).toHaveProperty('afiliado');
      expect(res.body).toHaveProperty('coseguro');
      expect(res.body).toHaveProperty('padrones');
      expect(res.body).toHaveProperty('precioBase');
      expect(res.body.coseguro.estado).toBe('activo');
    });

    it('debe mostrar coseguro nulo si no existe', async () => {
      const afiliado = await createTestAfiliado(organizacionId, '99887765');
      const p = await createTestPadron(organizacionId, afiliado.id, 'P-PANEL-2');

      const res = await request(app.getHttpServer())
        .get(`/coseguro/afiliados/${afiliado.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('X-Organizacion-ID', organizacionId)
        .expect(200);

      expect(res.body.coseguro).toBeNull();
      expect(res.body.precioBase).toBeGreaterThanOrEqual(0); // precio base vigente
    });
  });
});
