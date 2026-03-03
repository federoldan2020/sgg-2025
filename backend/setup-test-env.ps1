# setup-test-env.ps1
# ──────────────────
# PowerShell script para configurar el ambiente de tests e2e (Windows)
# Uso: .\setup-test-env.ps1 [-Clean] [-Run]

param(
    [switch]$Clean,
    [switch]$Run
)

# Color functions
function Write-Success { Write-Host $args -ForegroundColor Green }
function Write-Warning { Write-Host $args -ForegroundColor Yellow }
function Write-Error { Write-Host $args -ForegroundColor Red }

# Get paths
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir
$EnvFile = Join-Path $ProjectRoot ".env.test"

Write-Success "═══════════════════════════════════════════════════════════"
Write-Success "  Setup E2E Test Environment (Windows)"
Write-Success "═══════════════════════════════════════════════════════════"

# Check Node.js
$NodeVersion = node --version 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Error "✗ Node.js no está instalado"
    exit 1
}
Write-Success "✓ Node.js $NodeVersion"

# Check npm
$NpmVersion = npm --version 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Error "✗ npm no está instalado"
    exit 1
}
Write-Success "✓ npm $NpmVersion"

# Create .env.test if doesn't exist
if (!(Test-Path $EnvFile)) {
    Write-Warning "→ Creando .env.test..."
    $EnvContent = @"
NODE_ENV=test
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/test_sgg_2025
JWT_SECRET=test-secret-key-12345
REDIS_URL=redis://localhost:6379
"@
    Set-Content -Path $EnvFile -Value $EnvContent -Encoding UTF8
    Write-Success "✓ .env.test creado"
}
else {
    Write-Success "✓ .env.test ya existe"
}

# Install dependencies
Write-Warning "→ Instalando dependencias..."
Push-Location $ProjectRoot
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Error "✗ Error instalando dependencias"
    Pop-Location
    exit 1
}
Pop-Location
Write-Success "✓ Dependencias instaladas"

# Setup database
Write-Warning "→ Configurando base de datos..."

# Parse .env.test
$EnvContent = Get-Content $EnvFile
$DbUrl = $EnvContent | Select-String "DATABASE_URL=" | ForEach-Object { $_ -replace "DATABASE_URL=", "" }

Write-Success "  Base de datos: $DbUrl"

# Apply migrations
Write-Warning "→ Aplicando migraciones..."
$env:NODE_ENV = "test"
Push-Location $ProjectRoot

if ($Clean) {
    Write-Warning "→ Limpiando base de datos..."
    npx prisma migrate reset --force --skip-generate
    if ($LASTEXITCODE -ne 0) {
        Write-Error "✗ Error limpiando base de datos"
        Pop-Location
        exit 1
    }
    Write-Success "✓ Base de datos limpia y migraciones aplicadas"
}
else {
    npx prisma migrate deploy --skip-generate
    if ($LASTEXITCODE -ne 0) {
        Write-Error "✗ Error aplicando migraciones"
        Pop-Location
        exit 1
    }
    Write-Success "✓ Migraciones aplicadas"
}

Pop-Location
Remove-Item env:NODE_ENV

Write-Success "═══════════════════════════════════════════════════════════"
Write-Success "✓ Setup completado exitosamente"
Write-Success "═══════════════════════════════════════════════════════════"

Write-Host ""
Write-Host "Comandos disponibles:"
Write-Warning "  npm run test:e2e           - Ejecutar todos los tests e2e"
Write-Warning "  npm run test:e2e -- --watch  - Modo watch"
Write-Warning "  npm run test:e2e -- --verbose - Con output detallado"
Write-Host ""
Write-Host "Tests específicos:"
Write-Warning "  npx jest --config ./test/jest-e2e.json circuito-afiliados"
Write-Warning "  npx jest --config ./test/jest-e2e.json circuito-padrones"
Write-Warning "  npx jest --config ./test/jest-e2e.json circuito-coseguros"
Write-Host ""

# Run if -Run flag
if ($Run) {
    Write-Warning "→ Ejecutando tests e2e..."
    npm run test:e2e
}
