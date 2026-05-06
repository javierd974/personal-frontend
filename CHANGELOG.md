# Changelog — Gestión Personal SmartDom

Todas las versiones notables de esta aplicación se documentan en este archivo.

El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y este proyecto adhiere a [Semantic Versioning](https://semver.org/lang/es/).

El estándar de versionado compartido entre las aplicaciones SmartDom para Los Notables se documenta en `gestion-rrhh-smartdom/VERSIONING.md` (referencia común al ecosistema).

---

## \[1.5.0\] — 2026-05-06

### Agregado

- **Recupero de contraseña desde el Login**. La pantalla de Login pasa a tener una state machine con tres modos:
  - `login` (default): formulario normal con link "¿Olvidaste tu contraseña?" al lado del label de Contraseña.
  - `forgot`: oculta el campo password y solicita solo el email; al enviar dispara `authService.resetPassword`, que internamente llama a `supabase.auth.resetPasswordForEmail` con `redirectTo=${origin}/reset-password`.
  - `forgot-sent`: pantalla de confirmación con check verde y instrucción de revisar inbox y carpeta de spam.
- **Página `/reset-password`** (`src/pages/ResetPassword.jsx`, ruta pública). Aterriza desde el email de recovery de Supabase, espera ~400 ms a que `detectSessionInUrl` procese el token del hash y valida la sesión:
  - Si la sesión existe: muestra form con nueva contraseña + confirmación. Validaciones: mínimo 6 caracteres y ambos campos coincidentes. Al confirmar llama a `authService.updatePassword`, cierra la sesión de recovery con `supabase.auth.signOut()` y redirige a `/login` con banner verde de éxito vía `location.state.info`.
  - Si el link es inválido o expiró: pantalla de error con botón "Volver al login".
- Ruta `/reset-password` agregada en `App.jsx` antes del catch-all para evitar que rebote al dashboard.

### Configuración externa requerida

- En el dashboard de Supabase del proyecto: **Authentication → URL Configuration → Redirect URLs**, agregar la URL del entorno de producción (`https://<dominio-prod>/reset-password`). Para desarrollo local también `http://localhost:5173/reset-password`. Sin esto, el link del email rebota con error.

---

## \[1.4.1\] — 2026-05-06

Primera versión bajo el estándar SemVer. Se bumpea desde `1.0.0` para reflejar que la aplicación lleva tiempo estable en producción y, a partir de aquí, las próximas releases siguen el versionado documentado en `gestion-rrhh-smartdom/VERSIONING.md`.

### Modificado

- **Rol de administrador unificado** con el resto del ecosistema Los Notables: la app pasa a aceptar `rol = 'admin'` en lugar de `rol = 'administrador'`. Se actualizaron las comparaciones de rol en `pages/Administracion.jsx`, `pages/Dashboard.jsx` (header de selección de local y bloque del usuario) y `components/admin/GestionUsuarios.jsx` (badge de color, label, y `<option value>` de los modales de crear y editar usuario). Las etiquetas visibles para el usuario (`"Administrador"`) no cambian.

### Agregado

- **Versión visible en la UI**, leída desde `package.json` en build time:
  - `vite.config.js` lee `package.json` y expone la global `__APP_VERSION__`.
  - `src/version.js` re-exporta la global como `APP_VERSION` para usar limpio desde React.
  - Footer del Login: `v{APP_VERSION}` debajo de "Desarrollado por SmartDom".
  - Header de selección de local (Dashboard): `Sistema de Gestión · v{APP_VERSION}`.
  - Bloque de usuario en la vista principal del Dashboard: `v{APP_VERSION}` debajo del email.

### Migración SQL requerida

Antes de desplegar esta versión, alinear los roles existentes en la tabla `usuarios` de Supabase para que coincidan con el nuevo valor que la app reconoce:

```sql
update usuarios
set rol = 'admin'
where rol = 'administrador';
```

Verificación posterior:

```sql
select id, email, rol from usuarios where rol = 'admin';
```

### Pendiente

- Crear `eslint.config.js` con `__APP_VERSION__: 'readonly'` declarado como global, alineado con `gestion-rrhh-smartdom`. Mientras tanto, `src/version.js` declara la global localmente con un comentario `/* global */`.
- Adoptar la convención `migrations/PERSONAL_NNN_descripcion.sql` para futuras migraciones SQL acompañadas a una release.
