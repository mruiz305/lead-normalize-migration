/**
 * Resolución de permisos (referencia para la app).
 *
 * Implícito (NO está en user_access_grant):
 *   - hierarchy_membership.is_leader = 1 → ADMIN en ese scope
 *   - lead.submitter_user_id = user → acceso a sus propios leads
 *
 * Explícito: user_access_grant (scope ajeno o temporal).
 *
 * can_export es independiente de access_level:
 *   - VIEW + can_export=1 → ver y exportar, sin editar
 *   - ADMIN implícito de líder → convención app: can_export=true salvo restricción HR
 */

const ACCESS_RANK = { VIEW: 1, EDIT: 2, ADMIN: 3 };

function accessRank(level) {
  return ACCESS_RANK[level] ?? 0;
}

function isGrantActive(grant, at = new Date()) {
  if (!grant?.is_active) return false;
  if (grant.valid_from && new Date(grant.valid_from) > at) return false;
  if (grant.valid_to && new Date(grant.valid_to) < at) return false;
  return true;
}

/** Combina permiso implícito y grants; export es OR de flags. */
function mergeAccess(implicit, grants) {
  let accessLevel = implicit?.access_level ?? null;
  let canExport = Boolean(implicit?.can_export);

  for (const g of grants) {
    if (!isGrantActive(g)) continue;
    if (!accessLevel || accessRank(g.access_level) > accessRank(accessLevel)) {
      accessLevel = g.access_level;
    }
    if (g.can_export) canExport = true;
  }

  return { access_level: accessLevel, can_export: canExport };
}

module.exports = {
  ACCESS_RANK,
  accessRank,
  isGrantActive,
  mergeAccess,
};
