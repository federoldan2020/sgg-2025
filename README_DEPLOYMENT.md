# 🚀 SGG-2025 - Sistema de Gestión de Garantías

Sistema completo de gestión para obras sociales desarrollado con tecnologías modernas.

## 🏗️ Stack Tecnológico

### Backend
- **NestJS** - Framework Node.js enterprise-grade
- **Prisma ORM** - Type-safe database access
- **PostgreSQL** - Base de datos relacional
- **BullMQ + Redis** - Sistema de colas y caché
- **JWT** - Autenticación segura

### Frontend
- **Next.js 15** - Framework React con SSR
- **Tailwind CSS 4** - Estilos utility-first
- **SWR** - Data fetching y caché
- **Radix UI** - Componentes accesibles

### DevOps
- **Docker** - Contenedorización
- **Nginx** - Reverse proxy y load balancing
- **GitHub Actions** - CI/CD automatizado

## 🚀 Inicio Rápido

### Desarrollo Local

#### Requisitos
- Node.js 20+
- Docker y Docker Compose
- Git

#### 1. Clonar repositorio
```bash
git clone https://github.com/tu-usuario/sgg-2025.git
cd sgg-2025
```

#### 2. Configurar variables de entorno
```bash
cp .env.example .env
# Editar .env con tus valores
```

#### 3. Iniciar con Docker
```bash
# Linux/Mac
./start.sh

# Windows PowerShell
.\start.ps1
```

O manualmente:
```bash
docker compose up -d
docker compose exec backend npx prisma migrate deploy
docker compose exec backend npm run seed
```

#### 4. Acceder a la aplicación
- **Frontend:** http://localhost:3010
- **Backend API:** http://localhost:3000
- **API Docs:** http://localhost:3000/api

### Sin Docker (Desarrollo)

#### Backend
```bash
cd backend
npm install
cp .env.example .env
npx prisma migrate dev
npm run seed
npm run start:dev
```

#### Frontend
```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

## 📦 Deployment en VPS

Ver [DEPLOYMENT.md](./DEPLOYMENT.md) para instrucciones detalladas de deployment.

### Resumen rápido:

1. **Preparar VPS** (Ubuntu 22.04)
2. **Instalar Docker**
3. **Configurar dominio** y SSL
4. **Clonar repositorio** en `/var/www/sgg-2025`
5. **Configurar GitHub Actions** con secrets
6. **Push a main** para auto-deploy

## 🔐 Seguridad

- JWT con expiración configurable
- Passwords hasheados con bcrypt
- CORS configurado
- Rate limiting en API
- SSL/TLS con Let's Encrypt
- Validación de inputs con class-validator

## 📊 Base de Datos

### Migraciones
```bash
# Crear nueva migración
cd backend
npx prisma migrate dev --name descripcion_cambio

# Aplicar migraciones en producción
npx prisma migrate deploy
```

### Backup
```bash
# Linux/Mac
./backup.sh

# Windows
.\backup.ps1
```

## 🧪 Testing

```bash
# Backend
cd backend
npm test
npm run test:e2e
npm run test:cov

# Frontend
cd frontend
npm test
npm run typecheck
```

## 📝 Scripts Disponibles

### Backend
- `npm run start:dev` - Modo desarrollo con hot-reload
- `npm run start:prod` - Modo producción
- `npm run build` - Compilar TypeScript
- `npm run seed` - Cargar datos de prueba
- `npm run crear-admin` - Crear usuario administrador

### Frontend
- `npm run dev` - Servidor de desarrollo
- `npm run build` - Build de producción
- `npm run start` - Iniciar en producción
- `npm run lint` - Linter
- `npm run typecheck` - Verificación de tipos

## 🔧 Configuración

### Variables de Entorno

#### Backend (.env)
```env
DATABASE_URL=postgresql://user:pass@localhost:5432/db
REDIS_HOST=localhost
REDIS_PORT=6379
JWT_SECRET=your-secret-here
JWT_EXPIRATION=1d
```

#### Frontend (.env.local)
```env
NEXT_PUBLIC_API_URL=http://localhost:3000
```

## 📁 Estructura del Proyecto

```
sgg-2025/
├── backend/           # API NestJS
│   ├── src/
│   │   ├── modulos/  # Módulos de negocio
│   │   ├── core/     # Funcionalidad core
│   │   └── infra/    # Infraestructura
│   ├── prisma/       # Schema y migraciones
│   └── test/         # Tests E2E
├── frontend/         # App Next.js
│   └── src/
│       ├── app/      # Routes y páginas
│       ├── components/ # Componentes React
│       └── servicios/  # API clients
├── nginx/            # Configuración Nginx
├── docs/             # Documentación
└── scripts/          # Scripts útiles
```

## 🐛 Troubleshooting

### El backend no se conecta a la BD
```bash
# Verificar que PostgreSQL está corriendo
docker compose ps postgres

# Ver logs
docker compose logs postgres
```

### Error de migraciones
```bash
# Resetear base de datos (⚠️ solo desarrollo)
docker compose exec backend npx prisma migrate reset
```

### Puerto ya en uso
```bash
# Cambiar puertos en .env
BACKEND_PORT=3001
FRONTEND_PORT=3011
```

## 📚 Documentación

- [Deployment Guide](./DEPLOYMENT.md) - Guía completa de deployment
- [API Documentation](./docs/DOC-03-API-Spec-Reintegros.md) - Especificación de API
- [Estado del Proyecto](./docs/ESTADO_PROYECTO.md) - Estado actual
- [Análisis Funcional](./docs/analisis-funcional-completo.md) - Análisis completo

## 🤝 Contribuir

1. Fork el proyecto
2. Crear branch de feature (`git checkout -b feature/nueva-funcionalidad`)
3. Commit cambios (`git commit -m 'feat: agregar nueva funcionalidad'`)
4. Push al branch (`git push origin feature/nueva-funcionalidad`)
5. Abrir Pull Request

## 📄 Licencia

Este proyecto es privado y confidencial.

## 👥 Soporte

Para soporte, contactar al equipo de desarrollo.

---

**Desarrollado con ❤️ para modernizar la gestión de obras sociales**
