#!/bin/bash

# Script para iniciar el proyecto localmente con Docker

set -e

echo "🚀 Iniciando SGG-2025 en modo desarrollo..."

# Verificar que existe .env
if [ ! -f .env ]; then
    echo "⚠️  No se encontró archivo .env"
    echo "📄 Copiando .env.example a .env..."
    cp .env.example .env
    echo "⚡ Por favor edita el archivo .env con tus credenciales"
    exit 1
fi

# Crear directorio de SSL si no existe
mkdir -p nginx/ssl

# Generar certificados auto-firmados para desarrollo local
if [ ! -f nginx/ssl/cert.pem ]; then
    echo "🔐 Generando certificados SSL auto-firmados para desarrollo..."
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout nginx/ssl/key.pem \
        -out nginx/ssl/cert.pem \
        -subj "/C=AR/ST=BuenosAires/L=BuenosAires/O=SGG/OU=Dev/CN=localhost"
fi

# Crear directorio de almacenamiento
mkdir -p storage/comprobantes

# Levantar servicios
echo "📦 Construyendo y levantando contenedores..."
docker compose up -d --build

# Esperar a que PostgreSQL esté listo
echo "⏳ Esperando a que PostgreSQL esté listo..."
sleep 5

# Ejecutar migraciones
echo "🗃️  Ejecutando migraciones de base de datos..."
docker compose exec backend npx prisma migrate deploy

# Ejecutar seed (opcional)
read -p "¿Deseas cargar datos de prueba? (s/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Ss]$ ]]; then
    echo "🌱 Cargando datos de prueba..."
    docker compose exec backend npm run seed
fi

echo "✅ ¡Proyecto iniciado correctamente!"
echo ""
echo "📍 URLs disponibles:"
echo "   Frontend: http://localhost:3010"
echo "   Backend API: http://localhost:3000"
echo "   Portainer (si está instalado): http://localhost:9000"
echo ""
echo "📊 Ver logs: docker compose logs -f"
echo "🛑 Detener: docker compose down"
