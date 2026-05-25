---
description: Configurar y ejecutar backups automáticos de la base de datos
---

# Backup automático de Fasty

Este workflow usa el endpoint protegido `GET /api/admin/backup.sql` para descargar un backup lógico SQL.

## Variables necesarias

Define estas variables en tu entorno o en el programador de tareas:

```powershell
$env:FASTY_API_URL="https://tu-dominio.com"
$env:FASTY_ADMIN_TOKEN="TOKEN_ADMIN_AQUI"
$env:FASTY_BACKUP_DIR="C:\\fasty-backups"
```

## Ejecutar backup manual

// turbo
```powershell
New-Item -ItemType Directory -Force -Path $env:FASTY_BACKUP_DIR | Out-Null; $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"; Invoke-WebRequest -Uri "$env:FASTY_API_URL/api/admin/backup.sql" -Headers @{ Authorization = "Bearer $env:FASTY_ADMIN_TOKEN" } -OutFile "$env:FASTY_BACKUP_DIR\fasty-backup-$timestamp.sql"
```

## Programar backup diario en Windows

Ejecuta PowerShell como administrador y crea una tarea programada:

```powershell
$script = 'New-Item -ItemType Directory -Force -Path $env:FASTY_BACKUP_DIR | Out-Null; $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"; Invoke-WebRequest -Uri "$env:FASTY_API_URL/api/admin/backup.sql" -Headers @{ Authorization = "Bearer $env:FASTY_ADMIN_TOKEN" } -OutFile "$env:FASTY_BACKUP_DIR\fasty-backup-$timestamp.sql"'
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -Command `$env:FASTY_API_URL='https://tu-dominio.com'; `$env:FASTY_ADMIN_TOKEN='TOKEN_ADMIN_AQUI'; `$env:FASTY_BACKUP_DIR='C:\fasty-backups'; $script"
$trigger = New-ScheduledTaskTrigger -Daily -At 3:00AM
Register-ScheduledTask -TaskName "Fasty Daily Database Backup" -Action $action -Trigger $trigger -Description "Descarga backup SQL diario de Fasty" -RunLevel Highest
```

## Recomendaciones de producción

- Guarda los backups fuera del servidor principal.
- Rota backups antiguos cada 30 o 60 días.
- Protege el token admin y cámbialo periódicamente.
- Verifica restauración en una base de pruebas al menos una vez al mes.
