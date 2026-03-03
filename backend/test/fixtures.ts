/**
 * test/fixtures.ts
 * ─────────────────
 * Helpers para setup de pruebas e2e:
 * - Crear organización
 * - Crear usuario y obtener JWT
 * - Seed de datos iniciales (padrones, reglas, etc.)
 */

import { PrismaClient, RolUsuario, EstadoUsuario } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

/**
 * Crear o limpiar una organización de prueba
 */
export async function setupTestOrganization(name = 'ORG_TEST_E2E') {
  // Limpiar si ya existe
  const existing = await prisma.organizacion.findUnique({
    where: { nombre: name },
  });

  if (existing) {
    // Soft delete cascada (aquí eliminamos todo)
    await prisma.organizacion.delete({
      where: { id: existing.id },
    });
  }

  // Crear nueva
  const org = await prisma.organizacion.create({
    data: {
      nombre: name,
      activo: true,
    },
  });

  return org;
}

/**
 * Crear usuario admin de prueba con password hasheado
 */
export async function createTestUser(organizacionId: string, email = 'test@example.com', password = 'Test1234!') {
  const passwordHash = await bcrypt.hash(password, 10);

  const usuario = await prisma.usuario.create({
    data: {
      organizacionId,
      email,
      username: email.split('@')[0],
      passwordHash,
      nombre: 'Test',
      apellido: 'User',
      roles: [RolUsuario.ADMIN],
      estado: EstadoUsuario.ACTIVO,
    },
  });

  return { usuario, password };
}

/**
 * Crear una sesión y obtener tokens JWT (simular login)
 */
export async function createTestSession(usuarioId: bigint, organizacionId: string) {
  const expiraEn = new Date();
  expiraEn.setHours(expiraEn.getHours() + 1);

  const sesion = await prisma.sesionUsuario.create({
    data: {
      usuarioId,
      organizacionId,
      refreshToken: `refresh_${Date.now()}_${Math.random()}`,
      tokenFamily: `family_${Date.now()}`,
      expiraEn,
      activa: true,
    },
  });

  return sesion;
}

/**
 * Seed de datos iniciales: regla de coseguro, parentescos, etc.
 */
export async function seedTestData(organizacionId: string) {
  // Crear regla de coseguro base (precio = 3500)
  const regla = await prisma.reglaPrecioCoseguro.create({
    data: {
      organizacionId,
      vigenteDesde: new Date('2025-01-01'),
      vigenteHasta: null,
      precioBase: '3500.00',
      activo: true,
    },
  });

  // Crear parentescos (para colaterales, si es necesario)
  const parentescos = await Promise.all([
    prisma.parentesco.create({
      data: {
        organizacionId,
        codigo: 1,
        descripcion: 'CONYUGE',
        activo: true,
      },
    }),
    prisma.parentesco.create({
      data: {
        organizacionId,
        codigo: 2,
        descripcion: 'HIJO/A',
        activo: true,
      },
    }),
  ]);

  return { regla, parentescos };
}

/**
 * Crear un afiliado de prueba
 */
export async function createTestAfiliado(organizacionId: string, dni: bigint | string = '12345678', nombre = 'Juan', apellido = 'Pérez') {
  const afiliado = await prisma.afiliado.create({
    data: {
      organizacionId,
      dni: BigInt(dni),
      nombre,
      apellido,
      estado: 'activo',
    },
  });

  return afiliado;
}

/**
 * Crear un padrón de prueba
 */
export async function createTestPadron(
  organizacionId: string,
  afiliadoId: bigint,
  padronCode = 'P001',
  centro = 1,
  sistema = 'ESC',
) {
  const padron = await prisma.padron.create({
    data: {
      organizacionId,
      afiliadoId,
      padron: padronCode,
      centro,
      sector: 1,
      clase: 'A',
      sistema,
      activo: true,
    },
  });

  return padron;
}

/**
 * Cleanup: eliminar organización (cascada)
 */
export async function cleanupTestOrganization(organizacionId: string) {
  try {
    await prisma.organizacion.delete({
      where: { id: organizacionId },
    });
  } catch (err) {
    // ignore si no existe
  }
}

/**
 * Cleanup global
 */
export async function cleanupAll() {
  await prisma.$disconnect();
}
