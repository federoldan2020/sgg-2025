# 🏢 Crear Organización UDAP

## 📋 Descripción

Script para crear la organización **UDAP** con toda su configuración inicial:
- Conceptos contables
- Parentescos
- Reglas de precios
- Configuración organizacional

## 🚀 Ejecución

### Opción 1: Durante el Setup Inicial

Después de ejecutar migraciones:

```bash
cd /var/www/sgg-2025/backend

# Crear organización UDAP
npm run crear-udap
```

### Opción 2: En Desarrollo Local

```bash
cd backend

# Asegúrate de estar conectado a PostgreSQL
npm run crear-udap
```

### Opción 3: Con ts-node directo

```bash
cd /var/www/sgg-2025/backend
ts-node src/scripts/crear-organizacion-udap.ts
```

## 📊 Qué crea el script

### 1. Organización
- **Nombre:** UDAP
- **ID:** UUID autogenerado
- **Estado:** Activa

### 2. Conceptos Contables
- CUOTA_SOC - Cuota Societaria
- COSEGURO - Coseguro
- ADIC_COL - Adicional por Colaterales
- ORDEN_CREDITO - Orden de Crédito
- COMP_MIN - Complemento por Mínimo
- CRED_FAV - Crédito a favor

### 3. Parentescos
- 1: CONYUGE
- 2: HIJO/A
- 3: PADRE/MADRE
- 4: HERMANO/A
- 6: HIJO DISCAPACITADO
- 7: SUEGRO/A
- 8: HIJO/A DISC(MAYOR 26 AÑOS)
- 9: NIETO/A MENOR TENENCIA
- 10: HIJO DISC(21 a 26 años)
- 11: CONY.C/AP Y/O ADM.PUBL

### 4. Reglas de Coseguro
- Precio base: $25,000

### 5. Escalas de Colaterales (HIJO/A)
- 1 hijo: $2,500
- 2 hijos: $5,000
- 3+ hijos: $10,000

### 6. Configuración Organizacional
- Cuenta de Ingresos: 4100-001
- Cuenta de Egresos: 5100-001
- Cuenta de Coseguro: 4110-001
- Cuenta de Colateral: 4120-001

## ✅ Output Esperado

```
🏢 Creando organización UDAP...
✅ Organización UDAP creada: {ID-UUID}
✅ Conceptos creados para UDAP
✅ Parentescos creados para UDAP
✅ Regla de coseguro creada para UDAP
✅ Escalas de colaterales creadas para UDAP
✅ Configuración de organización creada

🎉 ¡Organización UDAP completamente creada!

Detalles:
    - ID: {ID-UUID}
    - Nombre: UDAP
    - Activa: true
    - Conceptos: 6
    - Parentescos: 10
    - Escalas colaterales: 3 (para HIJO/A)
```

## 🔄 Ejecutarlo Múltiples Veces

El script está diseñado con `upsert`, lo que significa:
- Si la organización ya existe, **la actualiza** (solo activa)
- Si no existe, **la crea**
- Es **idempotente** - puedes ejecutarlo varias veces sin problemas

## 📝 Integración en Deployment

En el archivo [DEPLOYMENT_NO_DOCKER.md](../../DEPLOYMENT_NO_DOCKER.md), después de instalar dependencias:

```bash
# Backend
cd /var/www/sgg-2025/backend
npm ci --only=production
npx prisma generate
npx prisma migrate deploy
npm run build

# Crear usuario admin
npm run crear-admin

# Crear organización UDAP
npm run crear-udap
```

## 🐛 Troubleshooting

### Error: "Database connection error"
```bash
# Verifica que PostgreSQL está corriendo
sudo systemctl status postgresql

# Verifica la URL de conexión en .env
cat .env | grep DATABASE_URL
```

### Error: "Migration not found"
```bash
# Primero ejecuta las migraciones
npx prisma migrate deploy

# Luego el script
npm run crear-udap
```

### Error: "UDAP already exists"
```bash
# No es un error, el script actualiza la organización existente
# Ejecuta de nuevo para ver que funciona
npm run crear-udap
```

## 📚 Archivos Relacionados

- [crear-organizacion-udap.ts](../../src/scripts/crear-organizacion-udap.ts) - Script principal
- [schema.prisma](../../prisma/schema.prisma) - Modelos de datos
- [DEPLOYMENT_NO_DOCKER.md](../../DEPLOYMENT_NO_DOCKER.md) - Guía de deployment
