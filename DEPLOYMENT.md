# 🚀 Guía de Deployment en VPS

## 📋 Requisitos de la VPS

### Especificaciones Mínimas Recomendadas
- **CPU:** 2 vCPU
- **RAM:** 4 GB (mínimo), 8 GB recomendado
- **Disco:** 40 GB SSD
- **OS:** Ubuntu 22.04 LTS o Debian 12
- **Ancho de banda:** 2 TB/mes

### Proveedores Recomendados
- **DigitalOcean** - Droplet de $24/mes (2 vCPU, 4GB RAM)
- **Hetzner** - CPX21 €7.59/mes (3 vCPU, 4GB RAM) ⭐ Mejor precio/rendimiento
- **Vultr** - $18/mes (2 vCPU, 4GB RAM)
- **Linode** - $24/mes (2 vCPU, 4GB RAM)

## 🔧 Configuración Inicial del VPS

### 1. Conectarse al VPS
```bash
ssh root@tu-ip-vps
```

### 2. Actualizar sistema
```bash
apt update && apt upgrade -y
```

### 3. Usuario (ya existe: deploy-sistemas)

```bash
# Verificar que existe
id deploy-sistemas

# Asegurar permisos sudo
sudo usermod -aG sudo deploy-sistemas
sudo usermod -aG docker deploy-sistemas
```

### 4. Configurar SSH con clave pública
```bash
# En tu máquina local
ssh-keygen -t ed25519 -C "deploy-sistemas@sgg"

# Copiar clave al servidor
ssh-copy-id -i ~/.ssh/id_ed25519.pub deploy-sistemas@tu-ip-vps

# Conectarse con el nuevo usuario
ssh deploy-sistemas@tu-ip-vps
```

### 5. Configurar firewall
```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

### 6. Instalar Docker
```bash
# Instalar Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Agregar usuario al grupo docker
sudo usermod -aG docker $USER
newgrp docker

# Instalar Docker Compose
sudo apt install docker-compose-plugin -y

# Verificar instalación
docker --version
docker compose version
```

### 7. Instalar dependencias adicionales
```bash
sudo apt install -y git nginx certbot python3-certbot-nginx
```

## 📦 Deployment Manual (Primera vez)

### 1. Clonar repositorio
```bash
cd /var/www
sudo mkdir sgg-2025
sudo chown -R deploy-sistemas:deploy-sistemas sgg-2025
cd sgg-2025

git clone https://github.com/tu-usuario/sgg-2025.git .
```

### 2. Configurar variables de entorno
```bash
cp .env.example .env
nano .env
```

Completa con valores reales:
```env
POSTGRES_PASSWORD=TuPasswordSeguro123!
REDIS_PASSWORD=RedisPassword456!
JWT_SECRET=UnSecretoMuyLargoDe32CaracteresOMas
NEXT_PUBLIC_API_URL=https://api.tudominio.com
```

### 3. Obtener certificado SSL (Let's Encrypt)
```bash
# Primero, editar nginx/conf.d/default.conf con tu dominio real
nano nginx/conf.d/default.conf

# Certificado para el dominio principal
sudo certbot certonly --standalone -d tudominio.com -d www.tudominio.com

# Certificado para API
sudo certbot certonly --standalone -d api.tudominio.com

# Copiar certificados
sudo cp /etc/letsencrypt/live/tudominio.com/fullchain.pem nginx/ssl/cert.pem
sudo cp /etc/letsencrypt/live/tudominio.com/privkey.pem nginx/ssl/key.pem
sudo chown -R $USER:$USER nginx/ssl/
```

### 4. Construir y levantar contenedores
```bash
# Construir imágenes
docker compose build

# Levantar servicios
docker compose up -d

# Ver logs
docker compose logs -f
```

### 5. Ejecutar migraciones
```bash
docker compose exec backend npx prisma migrate deploy
docker compose exec backend npx prisma db seed
```

### 6. Crear usuario administrador
```bash
docker compose exec backend npm run crear-admin
```

## 🔄 GitHub Actions - CI/CD Automático

### 1. Configurar Secrets en GitHub

Ve a: **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

Agregar los siguientes secrets:

| Secret | Descripción | Ejemplo |
|--------|-------------|---------|
| `VPS_HOST` | IP o dominio del VPS | `123.456.789.012` |
| `VPS_USERNAME` | Usuario SSH | `deploy` |
| `VPS_SSH_KEY` | Clave privada SSH | Contenido de `~/.ssh/id_ed25519` |
| `VPS_PORT` | Puerto SSH (opcional) | `22` |
| `DOCKER_USERNAME` | Usuario Docker Hub (opcional) | `tuusuario` |
| `DOCKER_PASSWORD` | Token Docker Hub (opcional) | `dckr_pat_...` |

### 2. Obtener clave SSH privada
```bash
# En tu máquina local
cat ~/.ssh/id_ed25519
```
Copia todo el contenido (incluyendo `-----BEGIN` y `-----END`) y pégalo en el secret `VPS_SSH_KEY`.

### 3. Preparar el servidor para auto-deploy
```bash
# En el VPS
cd /var/www/sgg-2025

# Crear script de deploy
cat > deploy.sh << 'EOF'
#!/bin/bash
set -e

echo "🚀 Iniciando deployment..."

# Pull cambios
git pull origin main

# Rebuild y restart
docker compose pull
docker compose up -d --build

# Ejecutar migraciones
docker compose exec -T backend npx prisma migrate deploy

# Limpiar recursos no utilizados
docker system prune -f

echo "✅ Deployment completado!"
EOF

chmod +x deploy.sh
```

### 4. Probar workflow
```bash
# En tu repositorio local
git add .
git commit -m "feat: add CI/CD"
git push origin main
```

El workflow se ejecutará automáticamente y:
1. ✅ Ejecutará tests del backend
2. ✅ Ejecutará tests del frontend
3. ✅ Construirá las imágenes Docker
4. ✅ Desplegará en tu VPS automáticamente

## 🔍 Monitoreo y Mantenimiento

### Ver logs en tiempo real
```bash
# Todos los servicios
docker compose logs -f

# Solo backend
docker compose logs -f backend

# Solo frontend
docker compose logs -f frontend
```

### Ver estado de contenedores
```bash
docker compose ps
```

### Reiniciar servicios
```bash
# Todos
docker compose restart

# Solo uno
docker compose restart backend
```

### Actualizar aplicación manualmente
```bash
cd /var/www/sgg-2025
git pull origin main
docker compose up -d --build
docker compose exec backend npx prisma migrate deploy
```

### Backup de base de datos
```bash
# Crear backup
docker compose exec postgres pg_dump -U sgg_user sgg_db > backup_$(date +%Y%m%d).sql

# Restaurar backup
docker compose exec -T postgres psql -U sgg_user sgg_db < backup_20260124.sql
```

### Renovar certificados SSL (automático)
```bash
sudo certbot renew
```

## 📊 Monitoreo (Opcional pero Recomendado)

### Instalar Portainer (UI para Docker)
```bash
docker volume create portainer_data

docker run -d -p 9000:9000 \
  --name portainer --restart=always \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v portainer_data:/data \
  portainer/portainer-ce:latest
```

Acceder en: `https://tu-ip:9000`

## 🚨 Troubleshooting

### El contenedor no inicia
```bash
docker compose logs backend
```

### Error de conexión a base de datos
```bash
# Verificar que postgres está corriendo
docker compose ps postgres

# Verificar variables de entorno
docker compose exec backend env | grep DATABASE_URL
```

### Espacio en disco lleno
```bash
# Limpiar imágenes no utilizadas
docker system prune -a

# Ver uso de disco
df -h
du -sh /var/www/sgg-2025/*
```

### Reinicio completo
```bash
docker compose down
docker compose up -d --build
```

## 🎯 Checklist de Deployment

- [ ] VPS configurado y actualizado
- [ ] Docker y Docker Compose instalados
- [ ] Firewall configurado
- [ ] Dominio apuntando al VPS (A record)
- [ ] Certificados SSL obtenidos
- [ ] Variables de entorno configuradas
- [ ] Repositorio clonado
- [ ] Contenedores levantados
- [ ] Migraciones ejecutadas
- [ ] Usuario admin creado
- [ ] GitHub Actions configurado
- [ ] Backups programados

## 📚 Recursos Adicionales

- [Documentación Docker](https://docs.docker.com/)
- [Documentación Nginx](https://nginx.org/en/docs/)
- [Let's Encrypt](https://letsencrypt.org/)
- [GitHub Actions](https://docs.github.com/en/actions)
