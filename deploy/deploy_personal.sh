#!/usr/bin/env bash
# Deploy de la app de personal (gestion-personal-smartdom) en la VPS.
# Ubicación en la VPS: /opt/personal/deploy_personal.sh
# Uso: bash /opt/personal/deploy_personal.sh
set -Eeuo pipefail

APP_DIR="/opt/personal/app"
CONTAINER_NAME="personal_front"
HOST_PORT="3102"
CONTAINER_PORT="80"
BRANCH="main"
SUPA_REF="ddpjzfltfmfoenkxynpu"
VITE_SUPABASE_URL="https://${SUPA_REF}.supabase.co"
VITE_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkcGp6Zmx0Zm1mb2Vua3h5bnB1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwNjY2OTEsImV4cCI6MjA4NTY0MjY5MX0.T1TYXkZJo77sNMXMyixt1gpZVVd3qVXkXeFtMCpRmGg"

echo "==> Entrando a $APP_DIR"
cd "$APP_DIR"

echo "==> Actualizando repo ($BRANCH)"
git fetch origin
git reset --hard "origin/$BRANCH"
git log --oneline -n 3

TAG="personal-front:$(date +%Y%m%d-%H%M%S)"
echo "==> Building image: $TAG"
docker build --pull --no-cache \
  --build-arg VITE_SUPABASE_URL="$VITE_SUPABASE_URL" \
  --build-arg VITE_SUPABASE_ANON_KEY="$VITE_SUPABASE_ANON_KEY" \
  -t "$TAG" .

echo "==> Verificando que la URL de Supabase quedó embebida en el build"
if docker run --rm --entrypoint sh "$TAG" -c "grep -Rqs '${SUPA_REF}.supabase.co' /usr/share/nginx/html"; then
  echo "==> OK: URL encontrada en el build"
else
  echo "==> ERROR: la URL no quedó embebida. Se aborta ANTES de tocar el contenedor actual."
  echo "    Revisar que el Dockerfile declare ARG/ENV VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY antes de 'npm run build'."
  exit 1
fi

echo "==> Reemplazando contenedor $CONTAINER_NAME"
docker rm -f "$CONTAINER_NAME" 2>/dev/null || true
docker run -d \
  --name "$CONTAINER_NAME" \
  --restart unless-stopped \
  -p "127.0.0.1:${HOST_PORT}:${CONTAINER_PORT}" \
  "$TAG"

echo "==> Verificación final"
docker ps --filter "name=$CONTAINER_NAME" --format "table {{.ID}}\t{{.Image}}\t{{.Names}}\t{{.Ports}}"
curl -I "http://localhost:${HOST_PORT}" || true
echo "==> Deploy finalizado. (Caddy ya enruta al puerto ${HOST_PORT})"
