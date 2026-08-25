const config = require('../config');
const { withTarget, withSource } = require('../db');

const TABLES = [
  'app_user',
  'user_channel',
  'lead',
  'client',
  'client_channel',
  'client_address',
  'lead_accident',
  'lead_legal',
  'lead_clinical',
  'lead_injury',
  'lead_timeline',
  'lead_status_event',
  'lead_org_snapshot',
  'lead_insurance',
  'lead_party',
  'lead_party_injury_site',
  'lead_staff',
  'lead_sync_flag',
  'lead_note',
  'hierarchy_membership',
  'user_access_grant',
  'user_hr_period',
  'import_reject',
  'ref_attorney',
  'ref_tx_location',
  'ref_company',
  'ref_company_office',
  'ref_contact_channel_type',
  'ref_state',
  'ref_address_kind',
  'ref_insurance_carrier',
  'ref_accident_location_type',
  'ref_at_fault_type',
  'ref_severity_level',
  'ref_injury_site',
];

async function count(conn, db, table, where = '') {
  const [rows] = await conn.query(
    `SELECT COUNT(*) AS cnt FROM \`${db}\`.\`${table}\`${where ? ` WHERE ${where}` : ''}`
  );
  return Number(rows[0].cnt);
}

async function runValidate() {
  let sourceLeads = null;
  if (config.hasSeparateSource) {
    await withSource(async (conn) => {
      try {
        sourceLeads = await count(conn, config.source.database, 'tblLeads');
      } catch {
        sourceLeads = null;
      }
    });
  }

  const limit = Number(process.env.MIG_LIMIT || 0) || null;
  const expected = limit && sourceLeads ? Math.min(limit, sourceLeads) : sourceLeads;

  console.log('Validación\n');
  console.log('tabla                          | filas');
  console.log('-------------------------------|------');

  await withTarget(async (conn) => {
    const tgt = config.target.database;
    if (expected != null) {
      console.log(`${'tblLeads (origen)'.padEnd(31)}| ${sourceLeads}${limit ? ` (muestra ≤${limit})` : ''}`);
    }

    for (const table of TABLES) {
      try {
        const n = await count(conn, tgt, table);
        const flag = table === 'lead' && expected != null && n !== expected ? ' ← revisar' : '';
        console.log(`${table.padEnd(31)}| ${n}${flag}`);
      } catch {
        console.log(`${table.padEnd(31)}| (no existe)`);
      }
    }

    const [[{ phoneCnt }]] = await conn.query(`
      SELECT COUNT(*) AS phoneCnt
      FROM \`${tgt}\`.client_channel cc
      INNER JOIN \`${tgt}\`.ref_contact_channel_type ct ON ct.id_channel_type = cc.id_channel_type
      WHERE ct.medium_code = 'PHONE'
    `);
    const [[{ emailCnt }]] = await conn.query(`
      SELECT COUNT(*) AS emailCnt
      FROM \`${tgt}\`.client_channel cc
      INNER JOIN \`${tgt}\`.ref_contact_channel_type ct ON ct.id_channel_type = cc.id_channel_type
      WHERE ct.medium_code = 'EMAIL'
    `);
    console.log(`${'client_channel (PHONE)'.padEnd(31)}| ${phoneCnt}`);
    console.log(`${'client_channel (EMAIL)'.padEnd(31)}| ${emailCnt}`);

    const [[{ userPhoneCnt }]] = await conn.query(`
      SELECT COUNT(*) AS userPhoneCnt
      FROM \`${tgt}\`.user_channel uc
      INNER JOIN \`${tgt}\`.ref_contact_channel_type ct ON ct.id_channel_type = uc.id_channel_type
      WHERE ct.medium_code = 'PHONE'
    `);
    const [[{ userSocialCnt }]] = await conn.query(`
      SELECT COUNT(*) AS userSocialCnt
      FROM \`${tgt}\`.user_channel uc
      INNER JOIN \`${tgt}\`.ref_contact_channel_type ct ON ct.id_channel_type = uc.id_channel_type
      WHERE ct.medium_code = 'SOCIAL'
    `);
    console.log(`${'user_channel (PHONE)'.padEnd(31)}| ${userPhoneCnt}`);
    console.log(`${'user_channel (SOCIAL)'.padEnd(31)}| ${userSocialCnt}`);

    const rejects = await count(conn, tgt, 'import_reject');
    const userMiss = await count(conn, tgt, 'import_reject', "reject_reason = 'user_miss'");
    const officeMiss = await count(conn, tgt, 'import_reject', "reject_reason = 'office_catalog_miss'");
    const leadsWithSubmitter = await count(conn, tgt, 'lead', 'submitter_user_id IS NOT NULL');
    const leadsWithOffice = await count(conn, tgt, 'lead', 'id_company_office IS NOT NULL');
    const leadTotal = await count(conn, tgt, 'lead');
    console.log('');
    console.log(`import_reject total: ${rejects} (user_miss: ${userMiss}, office_catalog_miss: ${officeMiss})`);
    if (leadTotal > 0) {
      const pctSub = ((leadsWithSubmitter / leadTotal) * 100).toFixed(1);
      const pctOff = ((leadsWithOffice / leadTotal) * 100).toFixed(1);
      console.log(`leads con submitter_user_id: ${leadsWithSubmitter}/${leadTotal} (${pctSub}%)`);
      console.log(`leads con id_company_office: ${leadsWithOffice}/${leadTotal} (${pctOff}%)`);
    }
  });
}

module.exports = { runValidate };
