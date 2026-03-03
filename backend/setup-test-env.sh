#!/bin/bash

# setup-test-env.sh
# ─────────────────
# Script para configurar el ambiente de tests e2e
# Uso: ./setup-test-env.sh [--clean] [--run]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$PROJECT_ROOT/.env.test"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  Setup E2E Test Environment${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"

# Check Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}✗ Node.js no está instalado${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Node.js $(node --version)${NC}"

# Check npm
if ! command -v npm &> /dev/null; then
    echo -e "${RED}✗ npm no está instalado${NC}"
    exit 1
fi
echo -e "${GREEN}✓ npm $(npm --version)${NC}"

# Check PostgreSQL
if ! command -v psql &> /dev/null; then
    echo -e "${YELLOW}⚠ psql no encontrado en PATH (pero podría estar disponible)${NC}"
else
    echo -e "${GREEN}✓ psql $(psql --version | cut -d' ' -f3)${NC}"
fi

# Create .env.test if doesn't exist
if [ ! -f "$ENV_FILE" ]; then
    echo -e "${YELLOW}→ Creando .env.test...${NC}"
    cat > "$ENV_FILE" << 'EOF'
NODE_ENV=test
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/test_sgg_2025
JWT_SECRET=test-secret-key-12345
REDIS_URL=redis://localhost:6379
EOF
    echo -e "${GREEN}✓ .env.test creado${NC}"
else
    echo -e "${GREEN}✓ .env.test ya existe${NC}"
fi

# Parse arguments
CLEAN=false
RUN=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --clean)
            CLEAN=true
            shift
            ;;
        --run)
            RUN=true
            shift
            ;;
        *)
            echo "Opción desconocida: $1"
            exit 1
            ;;
    esac
done

# Install dependencies
echo -e "${YELLOW}→ Instalando dependencias...${NC}"
cd "$PROJECT_ROOT"
npm install
echo -e "${GREEN}✓ Dependencias instaladas${NC}"

# Setup database
echo -e "${YELLOW}→ Configurando base de datos...${NC}"

# Extract DB params from .env.test
DB_URL=$(grep DATABASE_URL "$ENV_FILE" | cut -d '=' -f2)
DB_HOST=$(echo "$DB_URL" | sed -n 's/.*@\([^:]*\).*/\1/p')
DB_PORT=$(echo "$DB_URL" | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
DB_NAME=$(echo "$DB_URL" | sed -n 's/.*\/\([^?]*\).*/\1/p')
DB_USER=$(echo "$DB_URL" | sed -n 's/.*:\/\/\([^:]*\).*/\1/p')

if [ -z "$DB_HOST" ]; then
    DB_HOST="localhost"
fi
if [ -z "$DB_PORT" ]; then
    DB_PORT="5432"
fi

echo -e "  Conectando a: ${GREEN}${DB_USER}@${DB_HOST}:${DB_PORT}/${DB_NAME}${NC}"

# Create database if doesn't exist
if command -v psql &> /dev/null; then
    PGPASSWORD=postgres psql -h "$DB_HOST" -U "$DB_USER" -p "$DB_PORT" -tc \
        "SELECT 1 FROM pg_database WHERE datname = '$DB_NAME'" | grep -q 1 || \
        PGPASSWORD=postgres psql -h "$DB_HOST" -U "$DB_USER" -p "$DB_PORT" -c "CREATE DATABASE $DB_NAME;"
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Base de datos lista${NC}"
    else
        echo -e "${YELLOW}⚠ No se pudo crear la base de datos (podría ya existir)${NC}"
    fi
else
    echo -e "${YELLOW}⚠ No se puede verificar BD sin psql${NC}"
fi

# Clean database if --clean flag
if [ "$CLEAN" = true ]; then
    echo -e "${YELLOW}→ Limpiando base de datos...${NC}"
    NODE_ENV=test npx prisma migrate reset --force --skip-generate
    echo -e "${GREEN}✓ Base de datos limpia y migraciones aplicadas${NC}"
else
    echo -e "${YELLOW}→ Aplicando migraciones...${NC}"
    NODE_ENV=test npx prisma migrate deploy --skip-generate
    echo -e "${GREEN}✓ Migraciones aplicadas${NC}"
fi

# Verify setup
echo -e "${YELLOW}→ Verificando setup...${NC}"
if NODE_ENV=test npx prisma db execute --stdin < /dev/null 2>&1; then
    echo -e "${GREEN}✓ Conexión a BD verificada${NC}"
else
    echo -e "${RED}✗ No se puede conectar a la base de datos${NC}"
    echo -e "  Verifica que PostgreSQL esté corriendo en ${DB_HOST}:${DB_PORT}"
    exit 1
fi

echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✓ Setup completado exitosamente${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"

echo -e ""
echo -e "Comandos disponibles:"
echo -e "  ${YELLOW}npm run test:e2e${NC}           - Ejecutar todos los tests e2e"
echo -e "  ${YELLOW}npm run test:e2e -- --watch${NC}  - Modo watch"
echo -e "  ${YELLOW}npm run test:e2e -- --verbose${NC} - Con output detallado"
echo -e ""
echo -e "Tests específicos:"
echo -e "  ${YELLOW}npx jest --config ./test/jest-e2e.json circuito-afiliados${NC}"
echo -e "  ${YELLOW}npx jest --config ./test/jest-e2e.json circuito-padrones${NC}"
echo -e "  ${YELLOW}npx jest --config ./test/jest-e2e.json circuito-coseguros${NC}"
echo -e ""

# Run if --run flag
if [ "$RUN" = true ]; then
    echo -e "${YELLOW}→ Ejecutando tests e2e...${NC}"
    npm run test:e2e
fi
