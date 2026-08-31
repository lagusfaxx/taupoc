#!/bin/sh
set -e

echo "→ Aplicando migraciones de base de datos…"

if migracion=$(npx prisma migrate deploy 2>&1); then
  echo "$migracion"
else
  echo "$migracion"
  echo ""
  case "$migracion" in
    *P1000*)
      echo "✖ La base de datos rechazó las credenciales."
      echo ""
      echo "  POSTGRES_PASSWORD solo se aplica cuando el volumen se crea por"
      echo "  primera vez. Si la cambiaste después, el rol conserva la anterior"
      echo "  y la línea 'Skipping initialization' aparece en el log de la base."
      echo ""
      echo "  Para resolverlo, una de dos:"
      echo "   · Borrar el volumen de la base y volver a desplegar. Con RUN_SEED=true"
      echo "     el catálogo se vuelve a cargar."
      echo "   · Cambiar la contraseña del rol dentro del contenedor de la base:"
      echo "       psql -U <usuario> -c \"ALTER USER <usuario> WITH PASSWORD '<nueva>';\""
      echo ""
      echo "  Revisa además que el valor no lleve un signo \$ sin escapar: Docker"
      echo "  Compose lo interpreta como variable y sustituye el secreto por otro."
      ;;
    *P1001*)
      echo "✖ No se pudo alcanzar el servidor de base de datos."
      echo "  Revisa el host y el puerto de DATABASE_URL, y que el servicio esté arriba."
      ;;
    *P1003*)
      echo "✖ La base de datos indicada en DATABASE_URL no existe y no se pudo crear."
      echo "  El usuario de la conexión necesita permiso CREATEDB, o hay que crearla antes."
      ;;
  esac
  # Pausa antes de salir: sin esto el reinicio del contenedor inunda el log
  # repitiendo el mismo error cada pocos segundos.
  sleep 10
  exit 1
fi

# El seed es una carga inicial. Si ya hay catálogo no toca nada, así que
# dejar RUN_SEED=true puesto no borra lo que se edite desde el panel.
if [ "${RUN_SEED}" = "true" ]; then
  echo "→ Ejecutando seed inicial…"
  npx tsx prisma/seed.ts || echo "⚠ El seed no se completó; la aplicación arranca igual."
fi

echo "→ Iniciando TAUPOC Chile en el puerto ${PORT:-3000}"
exec "$@"
