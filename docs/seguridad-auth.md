# Seguridad y Autenticación (SGG-2025)

Este documento resume lo que se implementó recientemente en materia de autenticación, autorización, multitenancy y protección por sede, y define guías claras para proteger nuevas rutas en el backend y frontend.

---
## 1. Componentes Clave (Backend)

### Modelos Prisma
- `Usuario`: credenciales, roles (`RolUsuario[]`), estado (`EstadoUsuario`), sede opcional (`sedeId`), bloqueo temporal, forzado de cambio de password.
- `SesionUsuario`: refresh token único, familia de tokens (`tokenFamily`), expiración (30 días), metadatos de IP/UserAgent, estado activa.
- `EventoAuditoria`: registro de acciones (login, USUARIO_CREAR, ORGANIZACION_CREAR, etc.).

### Endpoints Auth (`/auth`)
- `POST /auth/login`: valida credenciales, estado y bloqueos; crea sesión y entrega `accessToken` (15m) + `refreshToken` (30d).
- `POST /auth/refresh`: reutiliza *refresh token* válido para emitir nuevo *access token* (no rota refresh en esta versión).
- `POST /auth/logout`: invalida la sesión asociada al refresh token.
- `POST /auth/logout-all`: invalida todas las sesiones del usuario.
- `GET /auth/profile`: devuelve perfil del usuario autenticado.
- `GET /auth/verify`: verificación simple de token.

### Guards y Decorators
- `JwtAuthGuard`: protege rutas por defecto (excepto las marcadas con `@Public`).
- `RolesGuard`: valida presencia de uno o más roles (`@Roles(RolUsuario.ADMIN, ...)`). ADMIN y SUPERADMIN sobrepasan cualquier restricción.
- `@CurrentUser()`: inyecta el objeto `Usuario` (payload validado) en el handler.
- `@Public()`: marca rutas que no requieren autenticación.

### Multitenancy
- Header esperable: `X-Organizacion-ID` (configurable con `TENANT_HEADER`).
- Middleware global `org.middleware.ts`:
  - Extrae `organizacionId` de headers/query.
  - Si hay usuario autenticado (`req.user.organizacionId`), verifica concordancia. Si difiere: `ForbiddenException`.

### Protección por Sede
- En `caja.controller.ts`:
  - `abrir`: si el usuario tiene `sedeId`, sólo puede abrir caja en esa sede.
  - `cobrar`: valida que la caja pertenezca a la organización y su sede coincida con `user.sedeId`.
  - `cerrar`: si `referenciaId = "caja-<id>"`, se verifica sede de la caja contra `user.sedeId`.

### Logout Seguro
1. Frontend llama `POST /auth/logout` con el `refreshToken`.
2. Backend pone la sesión `activa = false`.
3. Frontend limpia `localStorage` (`accessToken`, `refreshToken`) y estado en memoria.

---
## 2. Componentes Clave (Frontend)

### Archivo `frontend/src/servicios/api.ts`
Incluye:
- Manejo de tokens (`accessToken`, `refreshToken`) y renovación automática.
- `authLogin`, `authLogout`, `authMe`, y `referenciaCierreCaja(cajaId)`.
- Reintento automático de requests en 401: intenta refresh y si falla ejecuta logout completo.

### Contexto de Autenticación
- `frontend/src/contexts/auth.tsx`:
  - Hidrata perfil en montaje (`authMe()`).
  - Expone `login`, `logout`, `hasRole`, `refreshProfile`.
  - Admin tiene acceso implícito a todas las secciones.

### Gate y Guard
- `AuthGate` (`frontend/src/components/auth/AuthGate.tsx`):
  - Redirige a `/login` si no autenticado.
  - Opcional: `roles` para exigir permisos; muestra fallback de prohibición.
- `RequireRole` (del contexto): para envolturas simples dentro de vistas ya autenticadas.

### Páginas Protegidas (ejemplos ya implementados)
- `Caja` (`/caja`): roles requeridos `CAJA`, `TESORERIA`, `ADMIN`.
- `Plan de Cuentas` (`/contabilidad/plan`): roles requeridos `CONTABILIDAD`, `ADMIN`.
- `Cierre de Caja`: usa helper `referenciaCierreCaja` para construir `referenciaId`.

---
## 3. Cómo Proteger Nuevas Rutas (Backend)

### Paso 1: Definir Roles
Si se necesita un nuevo rol, agregarlo al enum `RolUsuario` en el schema Prisma y regenerar el cliente:
```
npx prisma generate
```
Crear migración si se modifica el enum.

### Paso 2: Aplicar Guards
Por defecto el módulo usa `JwtAuthGuard` global (si está configurado en el AppModule). Para una ruta nueva:
```ts
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('reintegros')
export class ReintegrosController {
  @Post()
  @Roles(RolUsuario.SALUD)
  crear(@Body() dto: CrearReintegroDto, @CurrentUser() user: Usuario) { /* ... */ }
}
```

### Paso 3: Rutas Públicas
Si una ruta debe ser pública (ej: webhook, health-check):
```ts
@Public()
@Get('health')
status() { return { ok: true }; }
```

### Paso 4: Validar Organización
En servicios que usan `organizacionId` de la entidad, se recomienda:
```ts
if (entidad.organizacionId !== user.organizacionId) throw new ForbiddenException('Cross-tenant');
```
Esto complementa el middleware (defensa en profundidad).

### Paso 5: Validar Sede (si aplica)
Agregar chequeo:
```ts
if (user.sedeId && entidad.sede !== user.sedeId) throw new ForbiddenException('Sede inválida');
```

### Paso 6: Auditoría
- `AuditService.log(params)` registra en `EventoAuditoria` acciones sensibles.
- Integrado en: login, usuarios, organizaciones, caja (abrir/cobrar/cerrar), nómina (confirmar), terceros, padrones (crear/actualizar/eliminar/import), coseguro (alta/baja/upsert/modificar/suspender/rehabilitar), colaterales (crear/actualizar/eliminar/imputación), afiliados, órdenes de crédito.

---
## 4. Cómo Proteger Nuevas Páginas (Frontend)

### Opción A: Página Entera
```tsx
import AuthGate from '@/components/auth/AuthGate';

export default function NuevaSeccionPage() {
  return (
    <AuthGate roles={['FINANZAS', 'ADMIN']}> 
      <ContenidoFinanzas />
    </AuthGate>
  );
}
```

### Opción B: Sección Dentro de Página
```tsx
import { RequireRole } from '@/contexts/auth';

function PanelAvanzado() {
  return (
    <RequireRole roles={['ADMIN']}>Contenido restringido</RequireRole>
  );
}
```

### Opción C: Acción Condicional
```tsx
const { hasRole } = useAuth();
<button disabled={!hasRole('TESORERIA', 'ADMIN')}>Aprobar</button>
```

---
## 5. Flujo de Autenticación Completo
1. Usuario ingresa credenciales (email, password, organizacionId).
2. Backend emite `accessToken` (corto) y `refreshToken` (largo) + crea `SesionUsuario`.
3. Front almacena tokens y llama `authMe()` para hidratar perfil.
4. Requests se envían con `Authorization: Bearer <accessToken>` y header `X-Organizacion-ID`.
5. Si el access token expira, el cliente intenta `/auth/refresh` con el refresh token.
6. Si el refresh falla: logout forzado + redirección a `/login`.

---
## 6. Buenas Prácticas y Siguientes Mejoras
- Rotación de refresh tokens: rotar en cada `refresh` y almacenar la nueva versión (previene robo post-uso).
- Cookies httpOnly: mover `accessToken` y `refreshToken` a cookies seguras + CSRF token independiente.
- Auditoría: tabla de eventos de seguridad (login, logout, bloqueo, cambio de password, intentos fallidos).
- Límite de sesiones: restringir número máximo de sesiones simultáneas por usuario.
- Revocación de familia: invalidar todas las sesiones de una `tokenFamily` ante sospecha.
- Rate limiting: aplicar a `/auth/login` para mitigar brute force.
- 2FA opcional: por TOTP o correo para perfiles críticos.

---
## 7. Checklist para Nuevas Rutas Sensibles
| Ítem | Verificado |
|------|------------|
| Usa `JwtAuthGuard` | ✔ |
| Tiene `@Roles(...)` adecuado | ✔ |
| Valida `organizacionId` contra `user.organizacionId` | ✔ |
| Si aplica sede, valida `sedeId` | ✔ |
| No expone datos de otra organización | ✔ |
| Maneja correctamente errores `Forbidden/Unauthorized` | ✔ |
| (Opcional) Registra auditoría | ☐ |

---
## 8. Ejemplo Completo (Backend + Frontend)

### Backend
```ts
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RolUsuario.FINANZAS)
@Get('cuentas/:id')
obtenerCuenta(@Param('id') id: string, @CurrentUser() user: Usuario) {
  const cuenta = await this.finanzasService.obtener(id);
  if (!cuenta || cuenta.organizacionId !== user.organizacionId) {
    throw new NotFoundException();
  }
  return cuenta;
}
```

### Frontend
```tsx
import AuthGate from '@/components/auth/AuthGate';

export default function CuentaDetallePage({ params }) {
  return (
    <AuthGate roles={['FINANZAS', 'ADMIN']}> 
      <CuentaDetalle id={params.id} />
    </AuthGate>
  );
}
```

---
## 9. Cómo Extender Roles
1. Agregar nuevo valor al enum `RolUsuario` en `schema.prisma`.
2. Ejecutar migración (`npx prisma migrate dev --name add_new_role`).
3. Regenerar cliente (`npx prisma generate`).
4. Actualizar lógica de asignación en `usuarios.service.ts` si se requiere norma de validación.
5. Usar nuevo rol en `@Roles(NUEVO_ROL)` y en frontend `roles={["NUEVO_ROL"]}`.

---
## 10. Referencias de Código
- Contexto: `frontend/src/contexts/auth.tsx`
- Gate: `frontend/src/components/auth/AuthGate.tsx`
- Caja protegida: `frontend/src/app/caja/page.tsx`
- Plan contable protegido: `frontend/src/app/contabilidad/plan/page.tsx`
- Middleware multitenant: `backend/src/middleware/org.middleware.ts`
- Control de sede: `backend/src/modulos/caja/caja.controller.ts`

---
## 11. Superadmin y Organizaciones

### Rol SUPERADMIN
- Nuevo rol `SUPERADMIN` para el dueño de la plataforma.
- Acceso total a todas las secciones (como ADMIN).
- Puede ver y gestionar todas las organizaciones.
- Middleware de org: SUPERADMIN puede usar cualquier `X-Organizacion-ID` sin restricción.

### Endpoints Superadmin
- `GET/POST/PUT /organizaciones`: ABM de organizaciones (solo SUPERADMIN).
- `GET /organizaciones/:id/usuarios`: usuarios de una organización.

### Cómo asignar SUPERADMIN a un usuario
```sql
-- Reemplazar <email> y <organizacion_id> con los valores correctos
UPDATE "Usuario"
SET roles = array_append(roles, 'SUPERADMIN')
WHERE email = '<email>' AND "organizacionId" = '<organizacion_id>';

-- Si el usuario solo tiene un rol, reemplazar:
UPDATE "Usuario"
SET roles = ARRAY['SUPERADMIN']::"RolUsuario"[]
WHERE email = '<email>' AND "organizacionId" = '<organizacion_id>';
```

---
## 12. Próximos Pasos Recomendados
- Migrar a cookies seguras y CSRF token.
- Ampliar auditoría a más acciones (caja, nómina, etc.).
- Implementar rotación de refresh tokens.
- Test e2e: login → acceso protegido → refresh → logout → acceso denegado.

---
**Última actualización:** $(new Date().toISOString())
