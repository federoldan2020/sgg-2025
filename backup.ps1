# Script de backup para Windows

$BackupDir = ".\backups"
$Date = Get-Date -Format "yyyyMMdd_HHmmss"
$BackupFile = "$BackupDir\sgg_backup_$Date.sql"

# Crear directorio de backups si no existe
New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null

Write-Host "🗄️  Creando backup de base de datos..." -ForegroundColor Cyan

# Crear backup
docker compose exec -T postgres pg_dump -U sgg_user sgg_db > $BackupFile

# Comprimir backup
Compress-Archive -Path $BackupFile -DestinationPath "$BackupFile.zip" -Force
Remove-Item $BackupFile

Write-Host "✅ Backup creado exitosamente: $BackupFile.zip" -ForegroundColor Green

# Limpiar backups antiguos (mantener últimos 7 días)
$OldDate = (Get-Date).AddDays(-7)
Get-ChildItem -Path $BackupDir -Filter "*.zip" | Where-Object { $_.LastWriteTime -lt $OldDate } | Remove-Item

Write-Host "🧹 Backups antiguos eliminados" -ForegroundColor Yellow
Write-Host "📊 Backups disponibles:" -ForegroundColor Cyan
Get-ChildItem -Path $BackupDir -Filter "*.zip" | Format-Table Name, Length, LastWriteTime
