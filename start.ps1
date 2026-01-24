# PowerShell script para iniciar el proyecto localmente con Docker

Write-Host "🚀 Iniciando SGG-2025 en modo desarrollo..." -ForegroundColor Green

# Verificar que existe .env
if (-Not (Test-Path .env)) {
    Write-Host "⚠️  No se encontró archivo .env" -ForegroundColor Yellow
    Write-Host "📄 Copiando .env.example a .env..." -ForegroundColor Cyan
    Copy-Item .env.example .env
    Write-Host "⚡ Por favor edita el archivo .env con tus credenciales" -ForegroundColor Yellow
    exit 1
}

# Crear directorio de SSL si no existe
New-Item -ItemType Directory -Force -Path nginx\ssl | Out-Null

# Generar certificados auto-firmados para desarrollo local
if (-Not (Test-Path nginx\ssl\cert.pem)) {
    Write-Host "🔐 Generando certificados SSL auto-firmados para desarrollo..." -ForegroundColor Cyan
    
    # Verificar si OpenSSL está disponible
    if (Get-Command openssl -ErrorAction SilentlyContinue) {
        openssl req -x509 -nodes -days 365 -newkey rsa:2048 `
            -keyout nginx\ssl\key.pem `
            -out nginx\ssl\cert.pem `
            -subj "/C=AR/ST=BuenosAires/L=BuenosAires/O=SGG/OU=Dev/CN=localhost"
    } else {
        Write-Host "⚠️  OpenSSL no está instalado. Los certificados SSL deben generarse manualmente." -ForegroundColor Yellow
    }
}

# Crear directorio de almacenamiento
New-Item -ItemType Directory -Force -Path storage\comprobantes | Out-Null

# Levantar servicios
Write-Host "📦 Construyendo y levantando contenedores..." -ForegroundColor Cyan
docker compose up -d --build

# Esperar a que PostgreSQL esté listo
Write-Host "⏳ Esperando a que PostgreSQL esté listo..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# Ejecutar migraciones
Write-Host "🗃️  Ejecutando migraciones de base de datos..." -ForegroundColor Cyan
docker compose exec backend npx prisma migrate deploy

# Ejecutar seed (opcional)
$response = Read-Host "¿Deseas cargar datos de prueba? (s/n)"
if ($response -eq "s" -or $response -eq "S") {
    Write-Host "🌱 Cargando datos de prueba..." -ForegroundColor Cyan
    docker compose exec backend npm run seed
}

Write-Host ""
Write-Host "✅ ¡Proyecto iniciado correctamente!" -ForegroundColor Green
Write-Host ""
Write-Host "📍 URLs disponibles:" -ForegroundColor Cyan
Write-Host "   Frontend: http://localhost:3010" -ForegroundColor White
Write-Host "   Backend API: http://localhost:3000" -ForegroundColor White
Write-Host "   Portainer (si está instalado): http://localhost:9000" -ForegroundColor White
Write-Host ""
Write-Host "📊 Ver logs: docker compose logs -f" -ForegroundColor Yellow
Write-Host "🛑 Detener: docker compose down" -ForegroundColor Yellow
