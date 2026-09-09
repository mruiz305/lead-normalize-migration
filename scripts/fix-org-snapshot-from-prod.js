#!/usr/bin/env node
/**
 * Repara lead_org_snapshot (y lead.id_company_office) cuando intake diverge de prod tblLeads.
 *
 * Uso:
 *   node scripts/fix-org-snapshot-from-prod.js              # dry-run
 *   node scripts/fix-org-snapshot-from-prod.js --apply     # escribe
 *   node scripts/fix-org-snapshot-from-prod.js --apply --since=2026-08-01
 *   node scripts/fix-org-snapshot-from-prod.js --apply --ids=585891,586209
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { withSource, withTarget, closeAll } = require('../src/db');
const config = require('../src/config');

function parseArgs(argv) {
  const out = { apply: false, since: '2026-08-01', ids: null };
  for (const a of argv) {
    if (a === '--apply') out.apply = true;
    else if (a.startsWith('--since=')) out.since = a.slice('--since='.length);
    else if (a.startsWith('--ids=')) {
      out.ids = a
        .slice('--ids='.length)
        .split(',')
        .map((s) => Number(s.trim()))
        .filter((n) => Number.isFinite(n) && n > 0);
    }
  }
  return out;
}

function norm(v) {
  if (v == null) return null;
  const s = String(v).trim();
  return s === '' ? null : s.toLowerCase();
}

async function resolveUserId(conn, db, email) {
  const key = norm(email);
  if (!key) return null;
  const [rows] = await conn.query(
    `SELECT id_user FROM \`${db}\`.app_user WHERE LOWER(TRIM(email)) = ? LIMIT 1`,
    [key],
  );
  return rows[0]?.id_user != null ? Number(rows[0].id_user) : null;
}

async function resolveCompanyOfficeId(conn, db, officeCode) {
  const code = officeCode != null ? String(officeCode).trim().toUpperCase() : '';
  if (!code) return null;
  const [rows] = await conn.query(
    `SELECT id_company_office FROM \`${db}\`.ref_company_office
     WHERE UPPER(TRIM(office_code)) = ? AND is_active = 1 LIMIT 1`,
    [code],
  );
  return rows[0]?.id_company_office != null ? Number(rows[0].id_company_office) : null;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const I = config.target.database;
  const P = config.source.database;

  console.log(
    `fix-org-snapshot-from-prod (${args.apply ? 'APPLY' : 'dry-run'}) since=${args.since}` +
      (args.ids?.length ? ` ids=${args.ids.join(',')}` : ''),
  );

  await withSource(async (src) => {
    await withTarget(async (tgt) => {
      let candidates;
      if (args.ids?.length) {
        const ph = args.ids.map(() => '?').join(',');
        const [rows] = await tgt.query(
          `SELECT l.id_lead, org.office_legacy, org.office_code, org.office_name,
                  org.pod, org.team, org.region, org.directorate
           FROM \`${I}\`.lead l
           JOIN \`${I}\`.lead_org_snapshot org ON org.id_lead = l.id_lead
           WHERE l.id_lead IN (${ph})`,
          args.ids,
        );
        candidates = rows;
      } else {
        // TNFG creates freeze org from hierarchy_membership — primary mismatch risk.
        const [rows] = await tgt.query(
          `SELECT l.id_lead, org.office_legacy, org.office_code, org.office_name,
                  org.pod, org.team, org.region, org.directorate
           FROM \`${I}\`.lead l
           JOIN \`${I}\`.lead_org_snapshot org ON org.id_lead = l.id_lead
           WHERE l.created_at >= ? AND l.created_at < '2100-01-01'
             AND l.source_type = 'TNFG'`,
          [args.since],
        );
        candidates = rows;
      }

      if (!candidates.length) {
        console.log('No candidates.');
        return;
      }

      console.log(`Loaded ${candidates.length} candidate leads; comparing to prod in batches…`);

      const mismatches = [];
      const BATCH = 400;
      for (let i = 0; i < candidates.length; i += BATCH) {
        const chunk = candidates.slice(i, i + BATCH);
        const ids = chunk.map((r) => r.id_lead);
        const ph = ids.map(() => '?').join(',');
        const [prodRows] = await src.query(
          `SELECT idLead, office, officeName, officeLabel, pod, podName, team, teamName,
                  region, regionName, directorate, directorateName
           FROM \`${P}\`.tblLeads WHERE idLead IN (${ph})`,
          ids,
        );
        const prodById = new Map(prodRows.map((r) => [Number(r.idLead), r]));
        for (const c of chunk) {
          const p = prodById.get(Number(c.id_lead));
          if (!p) continue;
          if (norm(p.office) !== norm(c.office_legacy)) {
            mismatches.push({ intake: c, prod: p });
          }
        }
      }

      console.log(`Candidates: ${candidates.length}; office mismatches vs prod: ${mismatches.length}`);
      if (!mismatches.length) return;

      let fixed = 0;
      for (const { intake, prod } of mismatches) {
        const idLead = Number(intake.id_lead);
        const [
          officeUserId,
          podUserId,
          teamUserId,
          regionUserId,
          directorateUserId,
          idCompanyOffice,
        ] = await Promise.all([
          resolveUserId(tgt, I, prod.office),
          resolveUserId(tgt, I, prod.pod),
          resolveUserId(tgt, I, prod.team),
          resolveUserId(tgt, I, prod.region),
          resolveUserId(tgt, I, prod.directorate),
          resolveCompanyOfficeId(tgt, I, prod.officeLabel),
        ]);

        console.log({
          idLead,
          from: intake.office_legacy,
          to: prod.office,
          officeLabel: prod.officeLabel,
          officeUserId,
          idCompanyOffice,
        });

        if (!args.apply) continue;

        await tgt.query(
          `UPDATE \`${I}\`.lead_org_snapshot SET
             office_legacy = ?, office_name = ?, office_code = ?, office_user_id = ?,
             id_company_office = ?,
             pod = ?, pod_name = ?, pod_user_id = ?,
             team = ?, team_name = ?, team_user_id = ?,
             region = ?, region_name = ?, region_user_id = ?,
             directorate = ?, directorate_name = ?, directorate_user_id = ?,
             updated_at = NOW(3)
           WHERE id_lead = ?`,
          [
            prod.office ?? null,
            prod.officeName ?? null,
            prod.officeLabel ?? null,
            officeUserId,
            idCompanyOffice,
            prod.pod ?? null,
            prod.podName ?? null,
            podUserId,
            prod.team ?? null,
            prod.teamName ?? null,
            teamUserId,
            prod.region ?? null,
            prod.regionName ?? null,
            regionUserId,
            prod.directorate ?? null,
            prod.directorateName ?? null,
            directorateUserId,
            idLead,
          ],
        );

        await tgt.query(
          `UPDATE \`${I}\`.lead SET id_company_office = ?, updated_at = NOW(3) WHERE id_lead = ?`,
          [idCompanyOffice, idLead],
        );
        fixed += 1;
      }

      if (args.apply) console.log(`✓ Updated ${fixed} leads`);
      else console.log('Dry-run only. Re-run with --apply to write.');
    });
  });
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => closeAll());
