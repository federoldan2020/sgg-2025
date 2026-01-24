# GitHub Actions - Configuración de Secrets

## 📝 Secrets Requeridos

Para configurar CI/CD, necesitas agregar estos secrets en GitHub:

**Ubicación:** Settings → Secrets and variables → Actions → New repository secret

### 1. VPS_HOST
- **Descripción:** IP o dominio de tu VPS
- **Ejemplo:** `123.456.789.012` o `vps.tudominio.com`
- **Cómo obtenerlo:**
  ```bash
  # En tu VPS
  curl ifconfig.me
  ```

### 2. VPS_USERNAME
- **Descripción:** Usuario SSH en el VPS
- **Valor:** `deploy-sistemas`
- **Cómo verificarlo:**
  ```bash
  id deploy-sistemas
  ```

### 3. VPS_SSH_KEY
- **Descripción:** Clave privada SSH (completa, incluyendo BEGIN/END)
- **Cómo obtenerla:**
  ```bash
  # En tu máquina local
  cat ~/.ssh/id_ed25519
  ```
- **Formato:**
  ```
  -----BEGIN OPENSSH PRIVATE KEY-----
  b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtz
  c2gtZWQyNTUxOQAAACBK...
  ...toda la clave...
  -----END OPENSSH PRIVATE KEY-----
  ```

### 4. VPS_PORT (Opcional)
- **Descripción:** Puerto SSH
- **Valor por defecto:** `22`
- **Cuándo cambiarlo:** Si configuraste SSH en puerto diferente por seguridad

### 5. DOCKER_USERNAME (Opcional)
- **Descripción:** Usuario de Docker Hub
- **Cuándo necesario:** Si quieres publicar imágenes en Docker Hub
- **Ejemplo:** `tuusuario`

### 6. DOCKER_PASSWORD (Opcional)
- **Descripción:** Token de acceso de Docker Hub
- **Cómo obtenerlo:**
  1. Ir a https://hub.docker.com/settings/security
  2. New Access Token
  3. Copiar el token generado

## 🔧 Script para Generar SSH Keys

Si no tienes claves SSH, créalas:

### Windows (PowerShell)
```powershell
# Generar clave ED25519 (más segura y rápida)
ssh-keygen -t ed25519 -C "deploy@sgg-2025" -f $env:USERPROFILE\.ssh\sgg_deploy

# Ver clave pública (para copiar al VPS)
Get-Content $env:USERPROFILE\.ssh\sgg_deploy.pub

# Ver clave privada (para GitHub Secret)
Get-Content $env:USERPROFILE\.ssh\sgg_deploy
```

### Linux/Mac
```bash
# Generar clave
ssh-keygen -t ed25519 -C "deploy@sgg-2025" -f ~/.ssh/sgg_deploy

# Ver clave pública (para copiar al VPS)
cat ~/.ssh/sgg_deploy.pub

# Ver clave privada (para GitHub Secret)
cat ~/.ssh/sgg_deploy
```

## 📋 Checklist de Configuración

- [ ] Clave SSH generada
- [ ] Clave pública copiada al VPS (`~/.ssh/authorized_keys`)
- [ ] Secret `VPS_HOST` agregado en GitHub
- [ ] Secret `VPS_USERNAME` agregado en GitHub
- [ ] Secret `VPS_SSH_KEY` agregado en GitHub
- [ ] Conexión SSH probada desde local
- [ ] Push a `main` para probar workflow

## 🧪 Probar Conexión SSH

Antes de configurar GitHub Actions, prueba la conexión:

```bash
# Probar conexión SSH
ssh -i ~/.ssh/id_ed25519 deploy-sistemas@TU_IP_VPS

# Si funciona, estás listo para configurar GitHub Actions
```

## 🚀 Configuración del VPS

El VPS debe tener preparado:

```bash
# 1. Usuario deploy-sistemas con permisos
id deploy-sistemas
sudo usermod -aG sudo deploy-sistemas
sudo usermod -aG docker deploy-sistemas  # Solo si usas Docker

# 2. Directorio del proyecto
sudo mkdir -p /var/www/sgg-2025
sudo chown -R deploy-sistemas:deploy-sistemas /var/www/sgg-2025

# 3. Cambiar a ese usuario
su - deploy-sistemas
cd /var/www/sgg-2025

# 4. Repositorio clonado
git clone https://github.com/TU_USUARIO/sgg-2025.git .

# 5. Archivo .env configurado
cp .env.example .env
nano .env  # Editar con valores reales

# 6. Clave SSH del usuario deploy-sistemas configurada
mkdir -p ~/.ssh
chmod 700 ~/.ssh
nano ~/.ssh/authorized_keys  # Pegar clave pública
chmod 600 ~/.ssh/authorized_keys
```

## ⚙️ Variables de Entorno en el VPS

El archivo `/var/www/sgg-2025/.env` debe contener:

```env
# Database
POSTGRES_USER=sgg_user
POSTGRES_PASSWORD=TuPasswordSeguroAqui123!
POSTGRES_DB=sgg_db
DATABASE_URL=postgresql://sgg_user:TuPasswordSeguroAqui123!@postgres:5432/sgg_db

# Redis
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=OtroPasswordSeguro456!

# JWT
JWT_SECRET=UnSecretoMuyLargoDe32CaracteresOMasParaJWT789!
JWT_EXPIRATION=1d

# URLs
NEXT_PUBLIC_API_URL=https://api.tudominio.com
FRONTEND_URL=https://tudominio.com

# Environment
NODE_ENV=production
```

## 🔒 Mejores Prácticas de Seguridad

1. **Nunca** commitees claves privadas al repositorio
2. **Nunca** compartas los secrets de GitHub
3. **Usa** passwords largos (mínimo 32 caracteres)
4. **Genera** passwords con:
   ```bash
   # Linux/Mac/WSL
   openssl rand -base64 32
   
   # PowerShell
   -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | % {[char]$_})
   ```
5. **Rota** las claves SSH cada 6-12 meses
6. **Usa** claves ED25519 en lugar de RSA
7. **Habilita** 2FA en GitHub
8. **Limita** permisos de los tokens de Docker Hub

## 🎯 Workflow de Deployment

Una vez configurado, cada push a `main` ejecutará:

1. ✅ **Tests** - Backend y Frontend
2. ✅ **Build** - Imágenes Docker
3. ✅ **Deploy** - SSH al VPS
4. ✅ **Migrations** - Prisma migrate deploy
5. ✅ **Cleanup** - Imágenes antiguas

## 📊 Monitorear Deployments

Ver el estado de los deployments:

1. Ve a tu repositorio en GitHub
2. Click en "Actions"
3. Verás el historial de workflows

## 🐛 Troubleshooting

### Error: "Permission denied (publickey)"
```bash
# Verificar que la clave pública está en el VPS
ssh deploy@VPS_IP "cat ~/.ssh/authorized_keys"
```

### Error: "Host key verification failed"
```bash
# Agregar host a known_hosts
ssh-keyscan VPS_IP >> ~/.ssh/known_hosts
```

### Error: "git pull" fails
```bash
# En el VPS, configurar git para pull sin confirmación
cd /var/www/sgg-2025
git config pull.rebase false
```

### Error: "docker compose command not found"
```bash
# Verificar instalación de Docker Compose
docker compose version

# Si no está instalado
sudo apt update
sudo apt install docker-compose-plugin
```

---

**¿Necesitas ayuda con algún paso?** Pregúntame y te guío en detalle.
