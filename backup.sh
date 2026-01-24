#!/bin/bash

# Script para backup de base de datos

set -e

BACKUP_DIR="./backups"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/sgg_backup_$DATE.sql"

# Crear directorio de backups si no existe
mkdir -p $BACKUP_DIR

echo "🗄️  Creando backup de base de datos..."

# Crear backup
docker compose exec -T postgres pg_dump -U sgg_user sgg_db > $BACKUP_FILE

# Comprimir backup
gzip $BACKUP_FILE

echo "✅ Backup creado exitosamente: $BACKUP_FILE.gz"

# Limpiar backups antiguos (mantener últimos 7 días)
find $BACKUP_DIR -name "*.sql.gz" -mtime +7 -delete

echo "🧹 Backups antiguos eliminados"
echo "📊 Backups disponibles:"
ls -lh $BACKUP_DIR
