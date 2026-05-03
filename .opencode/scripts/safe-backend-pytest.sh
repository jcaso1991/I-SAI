#!/usr/bin/env bash
set -euo pipefail

if [ -z "${EXPO_PUBLIC_BACKEND_URL:-}" ]; then
  printf '%s\n' "No ejecuto los tests del backend porque EXPO_PUBLIC_BACKEND_URL está vacío."
  printf '%s\n' "Para evitar tocar datos reales por accidente, configurá una URL local antes de probar."
  exit 1
fi

case "$EXPO_PUBLIC_BACKEND_URL" in
  *preview.emergentagent.com*)
    printf '%s\n' "No ejecuto los tests: la URL apunta a preview.emergentagent.com."
    printf '%s\n' "Eso parece un entorno remoto. Los tests deben correr contra una URL local."
    exit 1
    ;;
esac

case "$EXPO_PUBLIC_BACKEND_URL" in
  http://localhost*|http://127.0.0.1*|http://[::1]*)
    ;;
  *)
    printf '%s\n' "No ejecuto los tests: EXPO_PUBLIC_BACKEND_URL no apunta a localhost."
    printf '%s\n' "Valor recibido: $EXPO_PUBLIC_BACKEND_URL"
    printf '%s\n' "Usá una URL que empiece con http://localhost, http://127.0.0.1 o http://[::1]."
    exit 1
    ;;
esac

# TODO: validar variables de entorno de datos antes de correr tests.
# Ejemplos a revisar cuando se confirme la configuración real del backend:
# - MONGO_URL
# - DB_NAME
# - cualquier URL/API externa
# Abortá si apuntan a servicios remotos o datos reales.

python -m pytest backend/tests
