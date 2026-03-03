# Script PowerShell para limpiar movimientos en PostgreSQL
# Uso: .\limpiar_movimientos.ps1 [--full] [--org ORGANIZACION_ID]
# NOTA: Si se usa --org, debe ser un UUID válido (evita inyección SQL).

param(
    [switch]$Full,
    [string]$OrgId = $null
)

# Validar OrgId como UUID si se proporciona (evita inyección SQL al interpolar en el script)
if ($OrgId) {
    $uuidRegex = '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'
    if ($OrgId -notmatch $uuidRegex) {
        Write-Host "ERROR: --org debe ser un UUID válido (ej: 550e8400-e29b-41d4-a716-446655440000)" -ForegroundColor Red
        exit 1
    }
}

# Configuración de conexión (ajustar según tu .env)
$env:PGPASSWORD = $env:DATABASE_URL -replace '.*:([^@]+)@.*', '$1'
$dbUrl = $env:DATABASE_URL -replace 'postgresql://', '' -replace '@.*', ''
$dbParts = $dbUrl -split ':'
$dbHost = $dbParts[0]
$dbPort = if ($dbParts.Length -gt 1) { $dbParts[1] } else { "5432" }
$dbUser = ($env:DATABASE_URL -replace 'postgresql://([^:]+):.*', '$1')
$dbName = ($env:DATABASE_URL -replace '.*@.*/(.*)', '$1')

Write-Host "🔴 ADVERTENCIA: Este script BORRARÁ todos los movimientos" -ForegroundColor Red
Write-Host "Base de datos: $dbName en $dbHost" -ForegroundColor Yellow
$confirm = Read-Host "¿Estás seguro? Escribe 'SI' para continuar"

if ($confirm -ne "SI") {
    Write-Host "Operación cancelada" -ForegroundColor Green
    exit
}

$sql = @"
BEGIN;

-- Borrar todos los movimientos
DELETE FROM "MovimientoAfiliado"$(if ($OrgId) { " WHERE `"organizacionId`" = '$OrgId'" });

-- Resetear saldos
UPDATE "Afiliado" SET saldo = 0$(if ($OrgId) { " WHERE `"organizacionId`" = '$OrgId'" });

-- Resetear órdenes
UPDATE "OrdenCredito" 
SET saldoTotal = importeTotal, 
    estado = CASE WHEN estado = 'anulada' THEN 'anulada' ELSE 'pendiente' END$(if ($OrgId) { " WHERE `"organizacionId`" = '$OrgId'" });

-- Resetear cuotas
UPDATE "OrdenCreditoCuota"
SET saldo = importe, cancelado = 0, 
    estado = CASE WHEN estado = 'anulada' THEN 'anulada' ELSE 'pendiente' END
WHERE ordenId IN (SELECT id FROM "OrdenCredito"$(if ($OrgId) { " WHERE `"organizacionId`" = '$OrgId'" }) WHERE estado != 'anulada');

-- Resetear obligaciones
UPDATE "Obligacion"
SET saldo = monto, 
    estado = CASE WHEN estado = 'anulada' THEN 'anulada' ELSE 'pendiente' END$(if ($OrgId) { " WHERE `"organizacionId`" = '$OrgId'" });
"@

if ($Full) {
    $sql += @"

-- Borrar pagos y aplicaciones (limpieza completa)
DELETE FROM "Aplicacion"$(if ($OrgId) { " WHERE pagoId IN (SELECT id FROM `"Pago`" WHERE `"organizacionId`" = '$OrgId')" });
DELETE FROM "MetodoPago"$(if ($OrgId) { " WHERE pagoId IN (SELECT id FROM `"Pago`" WHERE `"organizacionId`" = '$OrgId')" });
DELETE FROM "Pago"$(if ($OrgId) { " WHERE `"organizacionId`" = '$OrgId'" });
"@
}

$sql += @"

COMMIT;
"@

Write-Host "Ejecutando limpieza..." -ForegroundColor Cyan
echo $sql | psql -h $dbHost -p $dbPort -U $dbUser -d $dbName

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Limpieza completada exitosamente" -ForegroundColor Green
} else {
    Write-Host "❌ Error durante la limpieza" -ForegroundColor Red
}

