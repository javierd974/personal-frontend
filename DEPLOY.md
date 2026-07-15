# Deploy — App de Personal (gestion-personal-smartdom)

> **Fuente de verdad del despliegue.** El bloque de la VPS en el README viejo (que mencionaba
> Docker Swarm y `/usr/local/bin/deploy_personal.sh`) quedó **desactualizado**. Esto es lo real.

## Infraestructura (VPS)

- **Servidor:** `root@46.202.147.30` (hostname `srv1167544`)
- **Orquestación:** Docker **plano** (NO es Swarm)
- **Repo en la VPS:** `/opt/personal/app`  (remote `origin`, branch `main`)
- **Contenedor:** `personal_front`
- **Puerto:** `127.0.0.1:3102 -> 80` (nginx dentro del contenedor)
- **Imagen:** se etiqueta como `personal-front:<YYYYMMDD-HHMMSS>` en cada build
- **Reverse proxy:** Caddy (`/opt/caddy`) enruta el dominio público al puerto `3102`
- **Supabase:** proyecto `ddpjzfltfmfoenkxynpu` (`https://ddpjzfltfmfoenkxynpu.supabase.co`)
- **Script de deploy:** `/opt/personal/deploy_personal.sh` (copia versionada en `deploy/deploy_personal.sh`)

Las variables `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` se inyectan como **build args**
al construir la imagen (el front es estático, así que la config queda embebida en el build).

## Cómo desplegar

### 1. Subir cambios (desde la máquina de desarrollo)

```bash
git add .
git commit -m "..."
git push origin main
```

### 2. Ejecutar el deploy en la VPS

```bash
ssh root@46.202.147.30
bash /opt/personal/deploy_personal.sh
```

El script: entra a `/opt/personal/app`, hace `git fetch` + `git reset --hard origin/main`,
reconstruye la imagen sin caché con los build args de Supabase, **verifica que la URL quedó
embebida antes de tocar el contenedor** (si falla, aborta sin downtime), reemplaza el
contenedor `personal_front` en el puerto `3102` y valida con `curl`.

### Primera vez / si el script no existe en la VPS

Crear `/opt/personal/deploy_personal.sh` con el contenido de `deploy/deploy_personal.sh`
de este repo y darle permisos:

```bash
chmod +x /opt/personal/deploy_personal.sh
```

## Base de datos

Las migraciones de Supabase (tablas, RLS y RPCs) se aplican **directamente sobre el proyecto
Supabase** (`ddpjzfltfmfoenkxynpu`), no como parte de este deploy. Los `.sql` viven en el repo
`losnotables-control/supabase/migrations/` como registro histórico.

## Notas / gotchas

- El build es `--no-cache`, así que tarda varios minutos.
- La verificación de "URL embebida" busca en `/usr/share/nginx/html` dentro de la imagen.
  Si el Dockerfile cambia la ruta de servido, actualizar esa comprobación en el script.
- No hace falta redeploy de `losnotables-control` para features de esta app.
