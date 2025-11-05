import { Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  // Organización demo
  const org = await prisma.organizacion.upsert({
    where: { nombre: 'ORG_DEMO' },
    update: {},
    create: { nombre: 'ORG_DEMO' },
  });

  // Conceptos base
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
      where: { organizacionId_codigo: { organizacionId: org.id, codigo: c.codigo } },
      update: {},
      create: { organizacionId: org.id, ...c },
    });
  }

  // ================= Sprint 2: Parentescos + Reglas =================
  const parentescos = [
    { codigo: 1, descripcion: 'CONYUGE' },
    { codigo: 2, descripcion: 'HIJO/A' },
    { codigo: 3, descripcion: 'PADRE/MADRE' },
    { codigo: 4, descripcion: 'HERMANO/A' },
    { codigo: 6, descripcion: 'HIJO DISCAPACITADO' },
    { codigo: 7, descripcion: 'SUEGRO/A' },
    { codigo: 8, descripcion: 'HIJO/A DISC(MAYOR 26 AÑOS)' },
    { codigo: 9, descripcion: 'NIETO/A MENOR TENENCIA' },
    { codigo: 10, descripcion: 'HIJO DISC(21 a 26 años)' },
    { codigo: 11, descripcion: 'CONY.C/AP Y/O ADM.PUBL' },
  ];

  for (const p of parentescos) {
    await prisma.parentesco.upsert({
      where: {
        organizacionId_codigo_parentesco: {
          organizacionId: org.id,
          codigo: p.codigo,
        },
      },
      update: { descripcion: p.descripcion, activo: true },
      create: { organizacionId: org.id, codigo: p.codigo, descripcion: p.descripcion },
    });
  }

  // Regla base de coseguro (vigente desde hoy)
  await prisma.reglaPrecioCoseguro.create({
    data: {
      organizacionId: org.id,
      vigenteDesde: new Date(),
      precioBase: new Prisma.Decimal(25000),
    },
  });

  // Escalas de ejemplo para HIJO/A (código 2):
  const hijo = await prisma.parentesco.findUnique({
    where: { organizacionId_codigo_parentesco: { organizacionId: org.id, codigo: 2 } },
  });

  if (hijo) {
    await prisma.reglaPrecioColateral.createMany({
      data: [
        {
          organizacionId: org.id,
          parentescoId: hijo.id,
          cantidadDesde: 1,
          cantidadHasta: 1,
          vigenteDesde: new Date(),
          precioTotal: new Prisma.Decimal(2500),
        },
        {
          organizacionId: org.id,
          parentescoId: hijo.id,
          cantidadDesde: 2,
          cantidadHasta: 2,
          vigenteDesde: new Date(),
          precioTotal: new Prisma.Decimal(5000),
        },
        {
          organizacionId: org.id,
          parentescoId: hijo.id,
          cantidadDesde: 3,
          cantidadHasta: null,
          vigenteDesde: new Date(),
          precioTotal: new Prisma.Decimal(10000),
        },
      ],
    });
  }

  console.log('Seed OK (ORG_DEMO, Conceptos, Parentescos, Reglas)');
}

void main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
