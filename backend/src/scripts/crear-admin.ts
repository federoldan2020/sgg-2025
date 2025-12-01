import { PrismaClient, RolUsuario, EstadoUsuario } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function crearAdminInicial() {
  try {
    console.log('🚀 Creando usuario administrador inicial...');

    // Buscar la primera organización
    const org = await prisma.organizacion.findFirst();
    if (!org) {
      console.error('❌ No se encontró ninguna organización. Crea una organización primero.');
      return;
    }

    console.log(`📋 Usando organización: ${org.nombre} (${org.id})`);

    // Verificar si ya existe un admin
    const adminExistente = await prisma.usuario.findFirst({
      where: {
        organizacionId: org.id,
        roles: { has: RolUsuario.ADMIN },
      },
    });

    if (adminExistente) {
      console.log('⚠️  Ya existe un usuario administrador:', adminExistente.email);
      return;
    }

    // Crear usuario admin
    const passwordHash = await bcrypt.hash('admin123', 12);

    const admin = await prisma.usuario.create({
      data: {
        organizacionId: org.id,
        email: 'admin@udap.org.ar',
        username: 'admin',
        passwordHash,
        nombre: 'Administrador',
        apellido: 'Sistema',
        roles: [RolUsuario.ADMIN],
        estado: EstadoUsuario.ACTIVO,
        cambiarPassword: true, // Forzar cambio en primer login
      },
    });

    console.log('✅ Usuario administrador creado exitosamente:');
    console.log(`   📧 Email: ${admin.email}`);
    console.log(`   👤 Username: ${admin.username}`);
    console.log(`   🔑 Password: admin123`);
    console.log(`   🏢 Organización: ${org.nombre}`);
    console.log('');
    console.log('⚠️  IMPORTANTE: Cambia la contraseña en el primer login');

  } catch (error) {
    console.error('❌ Error creando usuario administrador:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  crearAdminInicial();
}

export { crearAdminInicial };
