#!/bin/sh
set -e

# Aplica las migraciones pendientes antes de levantar la aplicación.
# Es idempotente: si la base ya está al día, no hace nada.
echo "→ Aplicando migraciones de base de datos…"
npx prisma migrate deploy

# El seed usa upserts, así que puede repetirse sin duplicar datos.
# Actívalo con RUN_SEED=true en el primer despliegue.
if [ "${RUN_SEED}" = "true" ]; then
  echo "→ Ejecutando seed inicial…"
  npx tsx prisma/seed.ts || echo "⚠ El seed no se completó; la aplicación arranca igual."
fi

echo "→ Iniciando TAUPOC Chile en el puerto ${PORT:-3000}"
exec "$@"
