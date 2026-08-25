#!/usr/bin/env bash
# Renombra schema MySQL TNFG_MRUIZ → TNFG_INTAKE vía mysqldump.
# MySQL 8 devuelve [HY000][1450] si se usa RENAME TABLE entre schemas con FKs.
#
# Uso:
#   cd lead-normalize-migration
#   bash scripts/rename-schema-to-tnfg-intake.sh
#   bash scripts/rename-schema-to-tnfg-intake.sh --drop-old   # borra TNFG_MRUIZ al final
#
# Requisitos: mysql + mysqldump en PATH, .env con MIG_TARGET_*

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

load_env() {
  if [[ ! -f .env ]]; then
    return
  fi
  # dotenv evita que $ en passwords rompa el shell (ej. Darrellito2021$)
  eval "$(node -e "
    require('dotenv').config({ path: '.env' });
    for (const k of [
      'MIG_TARGET_HOST',
      'MIG_TARGET_PORT',
      'MIG_TARGET_USER',
      'MIG_TARGET_PASSWORD',
    ]) {
      console.log('export ' + k + '=' + JSON.stringify(String(process.env[k] ?? '')));
    }
  ")"
}

load_env

for dir in /opt/homebrew/bin /usr/local/bin /usr/local/mysql/bin; do
  if [[ -x "${dir}/mysql" && -x "${dir}/mysqldump" ]]; then
    export PATH="${dir}:${PATH}"
    break
  fi
done

if ! command -v mysql >/dev/null || ! command -v mysqldump >/dev/null; then
  echo "ERROR: instala cliente MySQL (mysql + mysqldump) o usa:" >&2
  echo "  npm run rename:schema-intake" >&2
  exit 127
fi

HOST="${MIG_TARGET_HOST:?MIG_TARGET_HOST requerido}"
PORT="${MIG_TARGET_PORT:-3306}"
USER="${MIG_TARGET_USER:?MIG_TARGET_USER requerido}"
PASSWORD="${MIG_TARGET_PASSWORD:-}"
OLD_SCHEMA="${OLD_SCHEMA:-TNFG_MRUIZ}"
NEW_SCHEMA="${NEW_SCHEMA:-TNFG_INTAKE}"
DROP_OLD=false

for arg in "$@"; do
  case "$arg" in
    --drop-old) DROP_OLD=true ;;
    -h|--help)
      echo "Uso: bash scripts/rename-schema-to-tnfg-intake.sh [--drop-old]"
      exit 0
      ;;
    *)
      echo "Opción desconocida: $arg" >&2
      exit 1
      ;;
  esac
done

mysql_base=(mysql -h "$HOST" -P "$PORT" -u "$USER" --protocol=TCP)
mysqldump_base=(mysqldump -h "$HOST" -P "$PORT" -u "$USER" --protocol=TCP)

if [[ -n "$PASSWORD" ]]; then
  export MYSQL_PWD="$PASSWORD"
fi

count_schemas() {
  local schema="$1"
  "${mysql_base[@]}" -N -e \
    "SELECT COUNT(*) FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = '${schema}'"
}

count_tables() {
  local schema="$1"
  "${mysql_base[@]}" -N -e \
    "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = '${schema}'"
}

echo "==> Diagnóstico"
echo "    Host: ${HOST}:${PORT}"
echo "    Origen:  ${OLD_SCHEMA}"
echo "    Destino: ${NEW_SCHEMA}"

old_exists="$(count_schemas "$OLD_SCHEMA")"
new_exists="$(count_schemas "$NEW_SCHEMA")"
old_tables="$(count_tables "$OLD_SCHEMA")"
new_tables=0
if [[ "$new_exists" == "1" ]]; then
  new_tables="$(count_tables "$NEW_SCHEMA")"
fi

echo "    ${OLD_SCHEMA} existe=${old_exists}, tablas=${old_tables}"
echo "    ${NEW_SCHEMA} existe=${new_exists}, tablas=${new_tables}"

if [[ "$old_exists" != "1" ]]; then
  echo "ERROR: no existe ${OLD_SCHEMA}" >&2
  exit 1
fi
if [[ "$old_tables" == "0" ]]; then
  echo "ERROR: ${OLD_SCHEMA} no tiene tablas/vistas" >&2
  exit 1
fi
if [[ "$new_tables" != "0" ]]; then
  echo "ERROR: ${NEW_SCHEMA} ya tiene ${new_tables} objetos. Vacíalo o bórralo antes." >&2
  exit 1
fi

echo "==> Crear ${NEW_SCHEMA}"
"${mysql_base[@]}" -e \
  "CREATE DATABASE IF NOT EXISTS \`${NEW_SCHEMA}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"

echo "==> Copiar ${OLD_SCHEMA} → ${NEW_SCHEMA} (mysqldump | mysql)"
"${mysqldump_base[@]}" \
  --single-transaction \
  --set-gtid-purged=OFF \
  --routines \
  --triggers \
  --events \
  --no-create-db \
  "$OLD_SCHEMA" | "${mysql_base[@]}" "$NEW_SCHEMA"

copied_tables="$(count_tables "$NEW_SCHEMA")"
echo "    Objetos en ${NEW_SCHEMA}: ${copied_tables}"

if [[ "$copied_tables" != "$old_tables" ]]; then
  echo "ERROR: conteo distinto (origen=${old_tables}, destino=${copied_tables})" >&2
  echo "       Revisa ${NEW_SCHEMA} antes de borrar ${OLD_SCHEMA}" >&2
  exit 1
fi

if [[ "$DROP_OLD" == "true" ]]; then
  echo "==> Eliminar ${OLD_SCHEMA}"
  "${mysql_base[@]}" -e "DROP DATABASE \`${OLD_SCHEMA}\`"
  echo "    Listo. Solo queda ${NEW_SCHEMA}."
else
  echo "==> Copia OK. ${OLD_SCHEMA} se mantiene (usa --drop-old para borrarlo)."
fi

echo "==> Verificación"
"${mysql_base[@]}" -e \
  "SELECT table_schema, table_type, COUNT(*) AS cnt
   FROM information_schema.tables
   WHERE table_schema IN ('${OLD_SCHEMA}', '${NEW_SCHEMA}')
   GROUP BY table_schema, table_type
   ORDER BY table_schema, table_type"

unset MYSQL_PWD
