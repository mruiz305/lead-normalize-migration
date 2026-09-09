#!/usr/bin/env bash
# Re-copia rangos PK faltantes de tblLeadsAuditBuffer (prod → TNFG_INTAKE).
# Usa --no-recreate + --on-duplicate-key-noop para append seguro.
set -euo pipefail
cd "$(dirname "$0")/.."

BATCH="${MIG_LEGACY_OPS_JSON_BATCH:-300}"

# Formato: pkMin:pkMax
# w1–w7 + rangos previos ya cerrados (2026-09-08).
# Cola pendiente: ids nuevos en prod después del último max en TNFG.
RANGES=(
  # Cola viva: ampliar max según MAX(id) en prod si el gap vuelve a crecer.
  "3024001:3030000"
)

for r in "${RANGES[@]}"; do
  pk_min="${r%%:*}"
  pk_max="${r##*:}"
  echo ""
  echo "======== Resume tblLeadsAuditBuffer ${pk_min}..${pk_max} ========"
  MIG_LEGACY_OPS_JSON_BATCH="$BATCH" \
    node scripts/copy-legacy-ops-tables.js \
      --only tblLeadsAuditBuffer \
      --no-recreate \
      --on-duplicate-key-noop \
      --pk-min "$pk_min" \
      --pk-max "$pk_max"
done

echo ""
echo "Listo: cola tblLeadsAuditBuffer."
