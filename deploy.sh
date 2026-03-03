#!/bin/bash
set -e

echo "🚀 Iniciando deployment..."

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

# Frontend
echo "📦 Actualizando frontend..."
cd ../frontend
npm ci --only=production
npm run build

# Restart con PM2 (solo apps definidas en ecosystem.config.js)
echo "🔄 Reiniciando aplicaciones..."
cd ..
pm2 restart ecosystem.config.js

echo "✅ Deployment completado!"

# Mostrar estado
pm2 status

