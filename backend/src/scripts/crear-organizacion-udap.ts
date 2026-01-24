import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

async function crearOrganizacionUDAP(): Promise<void> {
  console.log('🏢 Creando organización UDAP...');

  try {
    // 1. Crear organización UDAP
    const udap = await prisma.organizacion.upsert({
      where: { nombre: 'UDAP' },
      update: {
        activo: true,
      },
      create: {
        nombre: 'UDAP',
        activo: true,
      },
    });

    console.log('✅ Organización UDAP creada:', udap.id);

    // 2. Crear conceptos base para UDAP
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
        where: {
          organizacionId_codigo: {
            organizacionId: udap.id,
            codigo: c.codigo,
          },
        },
        update: {},
        create: {
          organizacionId: udap.id,
          ...c,
        },
      });
    }

    console.log('✅ Conceptos creados para UDAP');

    // 3. Crear parentescos para UDAP
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
            organizacionId: udap.id,
            codigo: p.codigo,
          },
        },
        update: { descripcion: p.descripcion, activo: true },
        create: {
          organizacionId: udap.id,
          codigo: p.codigo,
          descripcion: p.descripcion,
          activo: true,
        },
      });
    }

    console.log('✅ Parentescos creados para UDAP');

    // 4. Crear regla base de coseguro
    await prisma.reglaPrecioCoseguro.upsert({
      where: {
        organizacionId_vigenteDesde: {
          organizacionId: udap.id,
          vigenteDesde: new Date(new Date().toISOString().split('T')[0]),
        },
      },
      update: {},
      create: {
        organizacionId: udap.id,
        vigenteDesde: new Date(),
        precioBase: new Prisma.Decimal(25000),
      },
    });

    console.log('✅ Regla de coseguro creada para UDAP');

    // 5. Crear escalas de colaterales para HIJO/A
    const hijo = await prisma.parentesco.findUnique({
      where: {
        organizacionId_codigo_parentesco: {
          organizacionId: udap.id,
          codigo: 2,
        },
      },
    });

    if (hijo) {
      await prisma.reglaPrecioColateral.deleteMany({
        where: {
          organizacionId: udap.id,
          parentescoId: hijo.id,
        },
      });

      await prisma.reglaPrecioColateral.createMany({
        data: [
          {
            organizacionId: udap.id,
            parentescoId: hijo.id,
            cantidadDesde: 1,
            cantidadHasta: 1,
            vigenteDesde: new Date(),
            precioTotal: new Prisma.Decimal(2500),
          },
          {
            organizacionId: udap.id,
            parentescoId: hijo.id,
            cantidadDesde: 2,
            cantidadHasta: 2,
            vigenteDesde: new Date(),
            precioTotal: new Prisma.Decimal(5000),
          },
          {
            organizacionId: udap.id,
            parentescoId: hijo.id,
            cantidadDesde: 3,
            cantidadHasta: null,
            vigenteDesde: new Date(),
            precioTotal: new Prisma.Decimal(10000),
          },
        ],
      });

      console.log('✅ Escalas de colaterales creadas para UDAP');
    }

    // 6. Crear configuración de organización
    const config = await prisma.organizacionConfig.upsert({
      where: {
        organizacionId: udap.id,
      },
      update: {},
      create: {
        organizacionId: udap.id,
        cuentaContableIngreso: '4100-001',
        cuentaContableEgreso: '5100-001',
        cuentaContableCoseguro: '4110-001',
        cuentaContableColateral: '4120-001',
      },
    });

    console.log('✅ Configuración de organización creada');

    console.log('\n🎉 ¡Organización UDAP completamente creada!');
    console.log(`\nDetalles:
    - ID: ${udap.id}
    - Nombre: ${udap.nombre}
    - Activa: ${udap.activo}
    - Conceptos: ${conceptos.length}
    - Parentescos: ${parentescos.length}
    - Escalas colaterales: 3 (para HIJO/A)
    `);
  } catch (error) {
    console.error('❌ Error al crear organización UDAP:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

crearOrganizacionUDAP().catch(console.error);
