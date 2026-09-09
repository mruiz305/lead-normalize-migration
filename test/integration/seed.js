const { readSql, execSql } = require("../../src/sqlRunner");
const { LEAD_SELECT_COLUMNS } = require("../../src/migration/pipeline");

const DATE_COLS = new Set([
  "created",
  "dateCreated",
  "updated",
  "dob",
  "hotLeadStartTime",
  "doa",
  "dateLegalAccepted",
  "dateLegalRejected",
  "signingDate",
  "dateSigned",
  "appointmentDateTime",
  "dateClinicalAccepted",
  "dateClinicalRejected",
  "dateCameIn",
  "dateLockedDown",
  "dateDropped",
  "callbackDateTime",
  "lkaDate",
  "psngr1DOB",
  "psngr2DOB",
  "psngr3DOB2",
  "psngr4DOB",
  "psngr5DOB",
  "psngr1AppDateTime",
  "psngr2AppDateTime",
  "psngr3AppDateTime",
  "psngr4AppDateTime",
  "psngr5AppDateTime",
]);

const INT_COLS = new Set([
  "idLead",
  "isMinor",
  "isVIP",
  "isHotLead",
  "boostYN",
  "confirmed",
  "isCallBack",
  "isCallBackNew",
  "newLeads",
  "idAcc",
  "requestedDrop",
  "passengerCount",
  "policeReport",
  "drivingRideShare",
  "psgInRideShare",
  "commercialPolicy",
  "construction",
  "Truck",
  "ticketAttorney",
  "hasPrevAtty",
  "isNewAtty",
  "isDocuSigni",
  "isTeleMedicine",
  "requiresTransportation",
  "visits",
  "hasUM",
  "fracture",
  "ambulance",
  "hospital",
  "xray",
  "mri",
  "ctScans",
  "psngr1IsMinor",
  "psngr2IsMinor",
  "psngr3IsMinor",
  "psngr4IsMinor",
  "psngr5IsMinor",
]);

const DOMAIN_TABLES = [
  "import_reject",
  "lead_note",
  "lead_sync_flag",
  "lead_staff",
  "lead_insurance",
  "lead_party_injury_site",
  "lead_party",
  "lead_org_snapshot",
  "lead_timeline",
  "lead_injury_site",
  "lead_injury",
  "lead_clinical",
  "lead_legal",
  "lead_accident",
  "lead",
  "client_address",
  "client_channel",
  "client",
];

function colType(name) {
  if (name === "idLead") return "INT NOT NULL";
  if (INT_COLS.has(name)) return "INT DEFAULT NULL";
  if (DATE_COLS.has(name)) return "DATETIME DEFAULT NULL";
  return "TEXT";
}

function fixtureLeads() {
  const base = (id, extra) => ({
    idLead: id,
    firstName: `Lead${id}`,
    lastName: "Test",
    phone: `305555${String(id).padStart(4, "0")}`,
    email: `lead${id}@example.com`,
    created: "2024-03-01 10:00:00",
    dateCreated: "2024-03-01 10:00:00",
    updated: id === 1010 ? "2020-01-01 00:00:00" : "2024-06-01 12:00:00",
    leadStatus: "New Lead",
    officeLabel: "MIA",
    submitter: "rep@nofault.com",
    stage: "Owned",
    ...extra,
  });

  return [
    base(1001, { firstName: "Ana", email: "ana@example.com" }),
    base(1002, { firstName: "Bob" }),
    base(1003, { firstName: "Cora", pipInsurance: "GEICO" }),
    base(1004, {
      firstName: "Diego",
      injuries: "Neck",
      psngr1FirstName: "Luis",
      psngr1LastName: "Gomez",
      psngr1Phone: "3055550001",
    }),
    base(1005),
    base(1006),
    base(1007),
    base(1008),
    base(1009, { firstName: "Missy", officeLabel: "ZZZ" }),
    base(1010, { firstName: "Oldie" }),
  ];
}

async function applyBootstrap(conn, db) {
  await conn.query(`DROP DATABASE IF EXISTS \`${db}\``);
  await conn.query(`CREATE DATABASE \`${db}\``);
  await conn.changeUser({ database: db });
  const sql = readSql("01_bootstrap.sql");
  await execSql(conn, sql, "01_bootstrap.sql");
}

async function ensureTblLeadsSrc(conn, db) {
  const cols = LEAD_SELECT_COLUMNS.map((c) => `\`${c}\` ${colType(c)}`);
  await conn.query(`DROP TABLE IF EXISTS \`${db}\`.tblLeads_src`);
  await conn.query(`
    CREATE TABLE \`${db}\`.tblLeads_src (
      ${cols.join(",\n      ")},
      PRIMARY KEY (idLead)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}

async function seedCatalogs(conn, db) {
  await conn.query(
    `INSERT IGNORE INTO \`${db}\`.ref_company (id_company, company_name) VALUES (1, '1800 NO FAULT')`
  );
  await conn.query(
    `INSERT IGNORE INTO \`${db}\`.ref_company_office
      (id_company_office, id_company, office_code, display_name)
     VALUES (81, 1, 'MIA', 'Miami'), (82, 1, 'TPA', 'Tampa')`
  );
  await conn.query(
    `INSERT IGNORE INTO \`${db}\`.app_user (id_user, email, display_name)
     VALUES (501, 'rep@nofault.com', 'Rep Test')`
  );
  await conn.query(
    `INSERT IGNORE INTO \`${db}\`.ref_attorney (id_attorney, display_name, is_active)
     VALUES (31, 'Smith PA', 1)`
  );
}

async function seedLeads(conn, db, leads = fixtureLeads()) {
  const cols = LEAD_SELECT_COLUMNS;
  await conn.query(`DELETE FROM \`${db}\`.tblLeads_src`);
  for (const lead of leads) {
    const values = cols.map((c) => (lead[c] === undefined ? null : lead[c]));
    const ph = cols.map(() => "?").join(", ");
    await conn.query(
      `INSERT INTO \`${db}\`.tblLeads_src (${cols.map((c) => `\`${c}\``).join(", ")}) VALUES (${ph})`,
      values
    );
  }
}

async function truncateDomain(conn, db) {
  await conn.query("SET FOREIGN_KEY_CHECKS = 0");
  for (const table of DOMAIN_TABLES) {
    await conn.query(`TRUNCATE TABLE \`${db}\`.\`${table}\``);
  }
  await conn.query("SET FOREIGN_KEY_CHECKS = 1");
}

async function deleteLeadGraph(conn, db, glideId) {
  await conn.query("SET FOREIGN_KEY_CHECKS = 0");
  const [[lead]] = await conn.query(
    `SELECT id_lead FROM \`${db}\`.\`lead\` WHERE glide_id = ? LIMIT 1`,
    [glideId]
  );
  if (!lead) {
    await conn.query("SET FOREIGN_KEY_CHECKS = 1");
    return;
  }
  const id = lead.id_lead;
  await conn.query(
    `DELETE lpis FROM \`${db}\`.lead_party_injury_site lpis
     INNER JOIN \`${db}\`.lead_party lp ON lp.id_lead_party = lpis.id_lead_party
     WHERE lp.id_lead = ?`,
    [id]
  );
  const child = [
    "lead_insurance",
    "lead_note",
    "lead_staff",
    "lead_sync_flag",
    "lead_injury_site",
    "lead_injury",
    "lead_accident",
    "lead_legal",
    "lead_clinical",
    "lead_timeline",
    "lead_org_snapshot",
    "import_reject",
    "lead_party",
    "lead",
  ];
  for (const table of child) {
    await conn.query(`DELETE FROM \`${db}\`.\`${table}\` WHERE id_lead = ?`, [id]);
  }
  await conn.query("SET FOREIGN_KEY_CHECKS = 1");
}

async function orgSnapshotForLead(conn, db, glideId) {
  const [[row]] = await conn.query(
    `SELECT s.office_code, s.office_name, s.region, s.region_name, s.pod, s.pod_name,
            s.team, s.team_name, s.id_company_office
     FROM \`${db}\`.\`lead\` l
     INNER JOIN \`${db}\`.lead_org_snapshot s ON s.id_lead = l.id_lead
     WHERE l.glide_id = ?
     LIMIT 1`,
    [glideId]
  );
  return row || null;
}

async function clientNameForLead(conn, db, glideId) {
  const [[row]] = await conn.query(
    `SELECT c.first_name
     FROM \`${db}\`.\`lead\` l
     INNER JOIN \`${db}\`.lead_party p ON p.id_lead = l.id_lead AND p.is_primary_party = 1
     INNER JOIN \`${db}\`.client c ON c.id_client = p.id_client
     WHERE l.glide_id = ?
     LIMIT 1`,
    [glideId]
  );
  return row?.first_name ?? null;
}

module.exports = {
  fixtureLeads,
  applyBootstrap,
  ensureTblLeadsSrc,
  seedCatalogs,
  seedLeads,
  truncateDomain,
  deleteLeadGraph,
  clientNameForLead,
  orgSnapshotForLead,
};
