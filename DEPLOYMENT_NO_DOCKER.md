# 🚀 Deployment SIN Docker (Instalación Directa)

Esta guía es para deployment en VPS usando **instalación directa** de servicios (PostgreSQL, Redis, Node.js) en lugar de Docker.

## 📋 Requisitos del VPS

- **OS:** Ubuntu 22.04 LTS
- **RAM:** 4GB mínimo, 8GB recomendado
- **CPU:** 2 vCPU
- **Disco:** 40GB SSD
- **Proveedor recomendado:** Hetzner CPX31 (€13.90/mes)

## 🔧 Instalación Paso a Paso

### 1. Actualizar Sistema

```bash
sudo apt update && sudo apt upgrade -y
```

### 2. Instalar Node.js 20

```bash
# Instalar NodeSource repository
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -

# Instalar Node.js
sudo apt install -y nodejs

# Verificar instalación
node --version  # Debe mostrar v20.x
npm --version
```

### 3. Instalar PostgreSQL 16

```bash
# Agregar repositorio oficial de PostgreSQL
sudo sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
wget -qO- https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo tee /etc/apt/trusted.gpg.d/pgdg.asc &>/dev/null

# Instalar PostgreSQL
sudo apt update
sudo apt install -y postgresql-16 postgresql-contrib-16

# Verificar que está corriendo
sudo systemctl status postgresql
```

### 4. Configurar PostgreSQL

```bash
# Conectar como usuario postgres
sudo -u postgres psql

# Dentro de psql, ejecutar:
CREATE DATABASE sgg_db;
CREATE USER sgg_user WITH PASSWORD 'TuPasswordSeguro123!';
GRANT ALL PRIVILEGES ON DATABASE sgg_db TO sgg_user;
\q

# Habilitar conexiones locales
sudo nano /etc/postgresql/16/main/pg_hba.conf
# Agregar línea:
# local   sgg_db          sgg_user                                md5

# Reiniciar PostgreSQL
sudo systemctl restart postgresql
```

### 5. Instalar Redis

```bash
# Instalar Redis
sudo apt install -y redis-server

# Configurar para usar systemd
sudo nano /etc/redis/redis.conf
# Cambiar: supervised no → supervised systemd
# Configurar password: requirepass TuPasswordRedis456!

# Reiniciar Redis
sudo systemctl restart redis-server

# Verificar
redis-cli ping
# Debe responder: PONG
```

### 6. Instalar PM2 (Gestor de Procesos)

```bash
sudo npm install -g pm2

# Configurar PM2 para iniciar con el sistema
pm2 startup systemd
# Ejecutar el comando que PM2 te sugiera
```

### 7. Instalar Nginx

```bash
sudo apt install -y nginx

# Habilitar en el firewall
sudo ufw allow 'Nginx Full'
sudo ufw allow OpenSSH
sudo ufw enable
```

### 8. Instalar Certbot (SSL)

```bash
sudo apt install -y certbot python3-certbot-nginx
```

## 📦 Configuración del Proyecto

### 1. Usuario Deploy (ya existe: deploy-sistemas)

Si el usuario ya está creado, solo verifica permisos:

```bash
# Verificar que existe
id deploy-sistemas

# Asegurar permisos sudo (si es necesario)
sudo usermod -aG sudo deploy-sistemas

# Cambiar a ese usuario
su - deploy-sistemas
```

### 2. Clonar Repositorio

```bash
cd /var/www
sudo mkdir sgg-2025
sudo chown -R deploy-sistemas:deploy-sistemas sgg-2025
cd sgg-2025

git clone https://github.com/TU_USUARIO/sgg-2025.git .
```

### 3. Configurar Variables de Entorno

**Backend (.env):**
```bash
cd /var/www/sgg-2025/backend
nano .env
```

```env
NODE_ENV=production
PORT=3000

# PostgreSQL - Conexión LOCAL
DATABASE_URL=postgresql://sgg_user:TuPasswordSeguro123!@localhost:5432/sgg_db

# Redis - Conexión LOCAL
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=TuPasswordRedis456!

# JWT
JWT_SECRET=UnSecretoMuyLargoDe32CaracteresOMasParaJWT789!
JWT_EXPIRATION=1d
```

**Frontend (.env.production):**
```bash
cd /var/www/sgg-2025/frontend
nano .env.production
```

```env
NODE_ENV=production
NEXT_PUBLIC_API_URL=https://api.tudominio.com
```

### 4. Instalar Dependencias y Build

**Backend:**
```bash
cd /var/www/sgg-2025/backend
npm ci --only=production
npx prisma generate
npx prisma migrate deploy
npm run build

# Crear usuario admin
npm run crear-admin
```

**Frontend:**
```bash
cd /var/www/sgg-2025/frontend
npm ci --only=production
npm run build
```

## 🚀 Configurar PM2

### Archivo ecosystem.config.js

```bash
cd /var/www/sgg-2025
nano ecosystem.config.js
```

```javascript
module.exports = {
  apps: [
    {
      name: 'sgg-backend',
      cwd: '/var/www/sgg-2025/backend',
      script: 'dist/src/main.js',
      instances: 2,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      error_file: '/var/www/sgg-2025/logs/backend-error.log',
      out_file: '/var/www/sgg-2025/logs/backend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      max_memory_restart: '500M',
      autorestart: true,
      watch: false
    },
    {
      name: 'sgg-frontend',
      cwd: '/var/www/sgg-2025/frontend',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3010',
      instances: 1,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3010
      },
      error_file: '/var/www/sgg-2025/logs/frontend-error.log',
      out_file: '/var/www/sgg-2025/logs/frontend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      max_memory_restart: '800M',
      autorestart: true,
      watch: false
    }
  ]
};
```

### Iniciar Aplicaciones

```bash
# Conectar como deploy-sistemas
su - deploy-sistemas
cd /var/www/sgg-2025

# Crear directorio de logs
mkdir -p logs

# Iniciar con PM2
pm2 start ecosystem.config.js

# Guardar configuración
pm2 save

# Configurar para iniciar con el sistema
pm2 startup systemd -u deploy-sistemas --hp /home/deploy-sistemas
# Ejecutar el comando que PM2 sugiera

# Ver estado
pm2 status

# Ver logs en tiempo real
pm2 logs
```

## 🌐 Configurar Nginx

### Configuración del Virtual Host

```bash
sudo nano /etc/nginx/sites-available/sgg-2025
```

```nginx
# Backend API
upstream backend {
    server 127.0.0.1:3000;
    keepalive 64;
}

# Frontend
upstream frontend {
    server 127.0.0.1:3010;
    keepalive 64;
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name tudominio.com www.tudominio.com api.tudominio.com;
    
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
    
    location / {
        return 301 https://$server_name$request_uri;
    }
}

# Backend API
server {
    listen 443 ssl http2;
    server_name api.tudominio.com;

    # SSL configurado por Certbot
    ssl_certificate /etc/letsencrypt/live/api.tudominio.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.tudominio.com/privkey.pem;
    
    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;
    limit_req zone=api_limit burst=20 nodelay;

    location / {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Connection "";
        
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    location /health {
        proxy_pass http://backend;
        access_log off;
    }
}

# Frontend
server {
    listen 443 ssl http2;
    server_name tudominio.com www.tudominio.com;

    ssl_certificate /etc/letsencrypt/live/tudominio.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/tudominio.com/privkey.pem;

    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    location / {
        proxy_pass http://frontend;
        proxy_http_version 1.1;
        
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Connection "";
        
        proxy_buffering off;
    }

    # Static files caching
    location /_next/static {
        proxy_pass http://frontend;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

### Activar configuración

```bash
# Crear symlink
sudo ln -s /etc/nginx/sites-available/sgg-2025 /etc/nginx/sites-enabled/

# Verificar configuración
sudo nginx -t

# Recargar Nginx
sudo systemctl reload nginx
```

## 🔐 Obtener Certificados SSL

```bash
# Certificado para dominio principal
sudo certbot --nginx -d tudominio.com -d www.tudominio.com

# Certificado para API
sudo certbot --nginx -d api.tudominio.com

# Verificar renovación automática
sudo certbot renew --dry-run
```

## 🔄 Script de Deployment

```bash
nano /var/www/sgg-2025/deploy.sh
```

```bash
#!/bin/bash
set -e

echo "🚀 Iniciando deployment..."

cd /var/www/sgg-2025

# Pull cambios
git pull origin main

# Backend
echo "📦 Actualizando backend..."
cd backend
npm ci --only=production
npx prisma generate
npx prisma migrate deploy
npm run build

# Frontend
echo "📦 Actualizando frontend..."
cd ../frontend
npm ci --only=production
npm run build

# Restart con PM2
echo "🔄 Reiniciando aplicaciones..."
cd ..
pm2 restart ecosystem.config.js

echo "✅ Deployment completado!"

# Mostrar estado
pm2 status
```

```bash
chmod +x /var/www/sgg-2025/deploy.sh
```

## 📊 Comandos Útiles

### PM2
```bash
# Ver estado
pm2 status

# Ver logs
pm2 logs
pm2 logs sgg-backend
pm2 logs sgg-frontend

# Reiniciar
pm2 restart all
pm2 restart sgg-backend

# Monitorear
pm2 monit

# Ver info detallada
pm2 info sgg-backend
```

### PostgreSQL
```bash
# Conectar a BD
sudo -u postgres psql sgg_db

# Backup
sudo -u postgres pg_dump sgg_db > backup_$(date +%Y%m%d).sql

# Restaurar
sudo -u postgres psql sgg_db < backup_20260124.sql

# Ver conexiones
sudo -u postgres psql -c "SELECT * FROM pg_stat_activity;"
```

### Nginx
```bash
# Verificar configuración
sudo nginx -t

# Recargar
sudo systemctl reload nginx

# Ver logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

## 🔄 CI/CD con GitHub Actions

El archivo de GitHub Actions necesita modificarse para deployment sin Docker:

```yaml
# .github/workflows/deploy-no-docker.yml
name: Deploy to VPS (No Docker)

on:
  push:
    branches:
      - main

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
      - name: Deploy via SSH
        uses: appleboy/ssh-action@v1.2.0
        with:
          host: ${{ secrets.VPS_HOST }}
          username: ${{ secrets.VPS_USERNAME }}
          key: ${{ secrets.VPS_SSH_KEY }}
          script: |
            cd /var/www/sgg-2025
            ./deploy.sh
```

## 🔒 Seguridad Adicional

### Configurar Firewall

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
sudo ufw status
```

### Hardening PostgreSQL

```bash
sudo nano /etc/postgresql/16/main/postgresql.conf

# Configurar:
# listen_addresses = 'localhost'
# max_connections = 100
# shared_buffers = 256MB
# effective_cache_size = 1GB

sudo systemctl restart postgresql
```

### Fail2Ban (Protección contra brute-force)

```bash
sudo apt install -y fail2ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

## 📈 Monitoreo

### PM2 Plus (Gratis para 1 servidor)

```bash
pm2 link YOUR_SECRET_KEY YOUR_PUBLIC_KEY
```

Obtén las keys en: https://app.pm2.io

## 🗂️ Backups Automáticos

```bash
sudo nano /etc/cron.daily/sgg-backup
```

```bash
#!/bin/bash
BACKUP_DIR="/var/backups/sgg"
DATE=$(date +%Y%m%d)

mkdir -p $BACKUP_DIR

# Backup PostgreSQL
sudo -u postgres pg_dump sgg_db | gzip > $BACKUP_DIR/db_$DATE.sql.gz

# Backup archivos subidos
tar -czf $BACKUP_DIR/storage_$DATE.tar.gz /var/www/sgg-2025/backend/storage

# Limpiar backups antiguos (>7 días)
find $BACKUP_DIR -mtime +7 -delete
```

```bash
sudo chmod +x /etc/cron.daily/sgg-backup
```

## 🎯 Checklist

- [ ] Node.js 20 instalado
- [ ] PostgreSQL 16 instalado y configurado
- [ ] Redis instalado y configurado
- [ ] PM2 instalado
- [ ] Nginx instalado y configurado
- [ ] SSL con Certbot configurado
- [ ] Proyecto clonado en /var/www/sgg-2025
- [ ] Variables de entorno configuradas
- [ ] Dependencias instaladas
- [ ] Migraciones ejecutadas
- [ ] PM2 iniciado y guardado
- [ ] Backups automáticos configurados
- [ ] Firewall configurado

---

**¿Ventajas de este enfoque?**
- ✅ Mejor performance (~10% más rápido)
- ✅ Menos RAM (~500MB menos)
- ✅ Control total sobre PostgreSQL
- ✅ Debugging más directo
- ✅ Sin overhead de Docker

**¿Desventajas?**
- ⚠️ Más complejo de mantener
- ⚠️ Dependencias del OS
- ⚠️ Más difícil rollback
- ⚠️ Setup inicial más largo
