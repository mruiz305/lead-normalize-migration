const config = require('../config');
const { withTarget, withSource } = require('../db');

async function tableExists(conn, db, table) {
  const [rows] = await conn.query(
    `SELECT 1 FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? LIMIT 1`,
    [db, table]
  );
  return rows.length > 0;
}

async function countRows(conn, db, table) {
  const [rows] = await conn.query(
    `SELECT COUNT(*) AS cnt FROM \`${db}\`.\`${table}\``
  );
  return Number(rows[0].cnt);
}

async function runStatus() {
  console.log('Destino:', `${config.target.user}@${config.target.host}/${config.target.database}`);
  if (config.hasSeparateSource) {
    console.log('Origen:', `${config.source.user}@${config.source.host}/${config.source.database}`);
    console.log('Mismo servidor MySQL:', config.sameServerAsTarget ? 'sí' : 'no');
  } else {
    console.log('Origen: (mismo que destino — modo staging en una BD)');
  }
  console.log('');

  await withTarget(async (conn) => {
    const leadTable = await tableExists(conn, config.target.database, 'lead');
    const tblLeadsOnTarget = await tableExists(conn, config.target.database, 'tblLeads');
    console.log(`[destino] tabla lead: ${leadTable ? 'existe' : 'no'}`);
    console.log(`[destino] tabla tblLeads: ${tblLeadsOnTarget ? 'existe' : 'no'}`);

    if (leadTable) {
      const leadCount = await countRows(conn, config.target.database, 'lead');
      console.log(`[destino] lead: ${leadCount} filas`);
      const [[wm]] = await conn.query(
        `SELECT COALESCE(MAX(id_lead), 0) AS maxId FROM \`${config.target.database}\`.\`lead\``
      );
      if (leadCount > 0) {
        console.log(`[destino] lead MAX(id_lead): ${wm.maxId}`);
      }
      console.log(`[destino] client: ${await countRows(conn, config.target.database, 'client')} filas`);
      const hmTable = await tableExists(conn, config.target.database, 'hierarchy_membership');
      if (hmTable) {
        console.log(`[destino] hierarchy_membership: ${await countRows(conn, config.target.database, 'hierarchy_membership')} filas`);
      }
      const officeTable = await tableExists(conn, config.target.database, 'ref_company_office');
      if (officeTable) {
        console.log(`[destino] ref_company_office: ${await countRows(conn, config.target.database, 'ref_company_office')} filas`);
      }
    }
    const appUserTable = await tableExists(conn, config.target.database, 'app_user');
    if (appUserTable) {
      console.log(`[destino] app_user: ${await countRows(conn, config.target.database, 'app_user')} filas`);
    }
    for (const cat of ['ref_attorney', 'ref_tx_location']) {
      const exists = await tableExists(conn, config.target.database, cat);
      if (exists) {
        console.log(`[destino] ${cat}: ${await countRows(conn, config.target.database, cat)} filas`);
      } else {
        console.log(`[destino] ${cat}: no existe`);
      }
    }
  });

  if (config.hasSeparateSource) {
    await withSource(async (conn) => {
      const exists = await tableExists(conn, config.source.database, 'tblLeads');
      console.log('');
      console.log(`[origen] tblLeads: ${exists ? 'existe' : 'NO existe'}`);
      if (exists) {
        const srcTotal = await countRows(conn, config.source.database, 'tblLeads');
        console.log(`[origen] tblLeads: ${srcTotal} filas`);
        if (config.hasSeparateSource) {
          await withTarget(async (tgtConn) => {
            const leadTable = await tableExists(tgtConn, config.target.database, 'lead');
            if (!leadTable) return;
            const [[{ maxId }]] = await tgtConn.query(
              `SELECT COALESCE(MAX(id_lead), 0) AS maxId FROM \`${config.target.database}\`.\`lead\``
            );
            const [[{ pending }]] = await conn.query(
              `SELECT COUNT(*) AS pending FROM \`${config.source.database}\`.tblLeads WHERE idLead > ?`,
              [maxId]
            );
            console.log(`[migración] pendientes (idLead > ${maxId}): ${pending} de ${srcTotal}`);
          });
        }
      }
      const gUsers = await tableExists(conn, config.source.database, 'g_users');
      console.log(`[origen] g_users: ${gUsers ? `${await countRows(conn, config.source.database, 'g_users')} filas` : 'NO existe'}`);
    });
  }
}

module.exports = { runStatus };
