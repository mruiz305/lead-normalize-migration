#!/usr/bin/env node
/** Repara id_stage en leads ya migrados (Owened → Owned). */

const { withSource, withTarget, closeAll } = require('../src/db');

const BATCH = 1000;
const OWNED_ID = 2;

async function main() {
  const ids = await withTarget(async (conn) => {
    const [rows] = await conn.query(
      'SELECT id_lead FROM `lead` WHERE id_stage IS NULL ORDER BY id_lead'
    );
    return rows.map((r) => r.id_lead);
  });

  if (!ids.length) {
    console.log('Nada que reparar (todos tienen id_stage).');
    return;
  }

  console.log(`Backfill stage: ${ids.length} leads con id_stage NULL\n`);
  let updated = 0;

  for (let i = 0; i < ids.length; i += BATCH) {
    const chunk = ids.slice(i, i + BATCH);
    const ph = chunk.map(() => '?').join(',');

    const [srcRows] = await withSource((conn) =>
      conn.query(`SELECT idLead, stage FROM tblLeads WHERE idLead IN (${ph})`, chunk)
    );

    const toOwned = [];
    const toProspect = [];
    for (const { idLead, stage } of srcRows) {
      const s = stage == null ? '' : String(stage).trim();
      if (s === 'Owned' || s === 'Owened') toOwned.push(idLead);
      else if (s === 'Prospect') toProspect.push(idLead);
    }

    if (toOwned.length) {
      const p = toOwned.map(() => '?').join(',');
      await withTarget((conn) =>
        conn.query(`UPDATE \`lead\` SET id_stage = ? WHERE id_lead IN (${p})`, [OWNED_ID, ...toOwned])
      );
      updated += toOwned.length;
    }
    if (toProspect.length) {
      const p = toProspect.map(() => '?').join(',');
      await withTarget((conn) =>
        conn.query(`UPDATE \`lead\` SET id_stage = 1 WHERE id_lead IN (${p})`, toProspect)
      );
      updated += toProspect.length;
    }

    process.stdout.write(`\r  ${Math.min(i + BATCH, ids.length)}/${ids.length} — ${updated} actualizados`);
  }

  console.log(`\n✓ ${updated} leads con id_stage reparado`);
}

main()
  .catch((e) => {
    console.error('\nError:', e.message);
    process.exit(1);
  })
  .finally(() => closeAll());
