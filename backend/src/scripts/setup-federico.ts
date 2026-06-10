/* eslint-disable no-console */
import { EstadoUsuario, PrismaClient, RolUsuario } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  // 1) Org UDAP
  const udap = await prisma.organizacion.upsert({
    where: { nombre: 'UDAP' },
    update: { activo: true },
    create: { nombre: 'UDAP', activo: true },
  });
  console.log(`✅ Organización UDAP: ${udap.id}`);

  // 2) Usuario admin Federico
  const email = 'federoldan.fr@gmail.com';
  const passwordHash = await bcrypt.hash('123456', 12);

  const existente = await prisma.usuario.findFirst({
    where: { organizacionId: udap.id, email },
  });

  if (existente) {
    await prisma.usuario.update({
      where: { id: existente.id },
      data: {
        passwordHash,
        nombre: 'Federico',
        apellido: 'Roldan',
        roles: [RolUsuario.ADMIN],
        estado: EstadoUsuario.ACTIVO,
        cambiarPassword: false,
      },
    });
    console.log(`♻️  Usuario actualizado: ${email}`);
  } else {
    await prisma.usuario.create({
      data: {
        organizacionId: udap.id,
        email,
        username: 'federoldan',
        passwordHash,
        nombre: 'Federico',
        apellido: 'Roldan',
        roles: [RolUsuario.ADMIN],
        estado: EstadoUsuario.ACTIVO,
        cambiarPassword: false,
      },
    });
    console.log(`✅ Usuario creado: ${email} (password: 123456)`);
  }

  // 3) Conceptos base para UDAP
  const conceptos = [
    { codigo: 'CUOTA_SOC', nombre: 'Cuota Societaria' },
    { codigo: 'COSEGURO', nombre: 'Coseguro' },
    { codigo: 'ADIC_COL', nombre: 'Adicional por Colaterales' },
    { codigo: 'ORDEN_CREDITO', nombre: 'Orden de Crédito' },
    { codigo: 'COMP_MIN', nombre: 'Complemento por Mínimo' },
    { codigo: 'CRED_FAV', nombre: 'Crédito a favor' },
  ];
  for (const c of conceptos) {
    await prisma.concepto.upsert({
      where: { organizacionId_codigo: { organizacionId: udap.id, codigo: c.codigo } },
      update: {},
      create: { organizacionId: udap.id, ...c },
    });
  }
  console.log(`✅ ${conceptos.length} conceptos base`);

  // 4) Parámetros iniciales del circuito de suspensiones
  const hoy = new Date('2026-06-01T00:00:00.000Z');

  const yaMin = await prisma.parametroJ17Minimo.findFirst({
    where: { organizacionId: udap.id, vigenteHasta: null },
  });
  if (!yaMin) {
    await prisma.parametroJ17Minimo.create({
      data: {
        organizacionId: udap.id,
        valor: 25000,
        vigenteDesde: hoy,
      },
    });
    console.log('✅ Parámetro J17_MINIMO: $25.000 vigente desde 2026-06-01');
  } else {
    console.log(`ℹ️  J17_MINIMO ya vigente: $${Number(yaMin.valor)}`);
  }

  const ya04 = await prisma.parametroJ17Cuota04.findFirst({
    where: { organizacionId: udap.id, vigenteHasta: null },
  });
  if (!ya04) {
    await prisma.parametroJ17Cuota04.create({
      data: {
        organizacionId: udap.id,
        valor: 70000,
        vigenteDesde: hoy,
      },
    });
    console.log('✅ Parámetro J17_CUOTA_04: $70.000 vigente desde 2026-06-01');
  } else {
    console.log(`ℹ️  J17_CUOTA_04 ya vigente: $${Number(ya04.valor)}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
