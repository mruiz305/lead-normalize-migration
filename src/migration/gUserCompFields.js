/** Mapeo compensación HR desde g_users (DealGoal legacy vs hrDealGoal). */

function toNumber(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function nonZeroNumber(v) {
  const n = toNumber(v);
  if (n == null || n === 0) return null;
  return n;
}

/** DealGoal (Glide) primero; hrDealGoal solo si trae monto distinto de cero. */
function resolveHrDealGoal(row) {
  return nonZeroNumber(row.DealGoal) ?? nonZeroNumber(row.hrDealGoal);
}

function resolveHrDealGoalCustom(row) {
  return nonZeroNumber(row.DealGoalCustom);
}

function resolvePaylocityId(row) {
  if (row.paylocityId == null) return null;
  const s = String(row.paylocityId).trim();
  return s === '' ? null : s;
}

module.exports = {
  resolveHrDealGoal,
  resolveHrDealGoalCustom,
  resolvePaylocityId,
};
