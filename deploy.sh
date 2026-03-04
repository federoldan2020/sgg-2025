#!/bin/bash
set -e

echo "🚀 Iniciando deployment..."

# Requerir Node 20+ (Nest 11 y varias deps lo exigen)
NODE_VER=$(node -v 2>/dev/null | sed 's/^v//' | cut -d. -f1)
if [ -z "$NODE_VER" ] || [ "$NODE_VER" -lt 20 ]; then
  echo "❌ Se requiere Node 20 o superior. Actual: $(node -v 2>/dev/null || echo 'no encontrado')"
  echo "   En la VPS: nvm use 20  (o instala Node 20 y vuelve a ejecutar)"
  exit 1
fi

cd /var/www/sgg-2025

# Sincronizar con el repo: descartar cambios locales y quedar igual que origin/main
git fetch origin
git reset --hard origin/main

# Backend (instalar todo: nest y prisma están en devDependencies y se necesitan para build/migrate)
echo "📦 Actualizando backend..."
cd backend
npm ci
npx prisma generate
npx prisma migrate deploy
npm run build

# Frontend (instalar todo: TypeScript y deps de build están en devDependencies)
echo "📦 Actualizando frontend..."
cd ../frontend
npm ci
npm run build

# Restart con PM2 (solo apps definidas en ecosystem.config.js)
echo "🔄 Reiniciando aplicaciones..."
cd ..
pm2 restart ecosystem.config.js

echo "✅ Deployment completado!"

# Mostrar estado
pm2 status

