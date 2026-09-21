require("./setupEnv");

const { describe, it, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const config = require("../../src/config");
const { withTarget, closeAll } = require("../../src/db");
const { loadCatalogMaps } = require("../../src/migration/maps");
const { runMigration, transformLead, flushLeadBatch } = require("../../src/migration/pipeline");
const { seedSeverityLevels } = require("../../src/migration/severityLevelCatalog");
const { seedAccidentLocationTypes } = require("../../src/migration/accidentLocationTypeCatalog");
const {
  applyBootstrap,
  ensureTblLeadsSrc,
  seedCatalogs,
  seedLeads,
  truncateDomain,
  clientNameForLead,
  orgSnapshotForLead,
} = require("./seed");

const db = config.target.database;

async function migrateAll({ limit = null, resume = false } = {}) {
  return withTarget(async (conn) => {
    await seedAccidentLocationTypes(conn);
    await seedSeverityLevels(conn);
    const maps = await loadCatalogMaps(conn);
    return runMigration(conn, conn, maps, { batchSize: 20, limit, resume });
  });
}

before(async () => {
  await withTarget(async (conn) => {
    await applyBootstrap(conn, db);
    await ensureTblLeadsSrc(conn, db);
    await seedCatalogs(conn, db);
  });
});

beforeEach(async () => {
  await withTarget(async (conn) => {
    await truncateDomain(conn, db);
    await seedLeads(conn, db);
  });
});

after(async () => {
  await closeAll();
});

describe("migrate fixture", () => {
  it("10 tblLeads → lead/client/channel/party y catalog miss no aborta el batch", async () => {
    const result = await migrateAll();
    assert.equal(result.migrated, 10);

    await withTarget(async (conn) => {
      const [[leads]] = await conn.query(`SELECT COUNT(*) AS n FROM \`${db}\`.\`lead\``);
      const [[clients]] = await conn.query(`SELECT COUNT(*) AS n FROM \`${db}\`.client`);
      const [[phones]] = await conn.query(`
        SELECT COUNT(*) AS n
        FROM \`${db}\`.client_channel cc
        INNER JOIN \`${db}\`.ref_contact_channel_type ct ON ct.id_channel_type = cc.id_channel_type
        WHERE ct.medium_code = 'PHONE'
      `);
      const [[parties]] = await conn.query(`SELECT COUNT(*) AS n FROM \`${db}\`.lead_party`);
      const [[miss]] = await conn.query(`
        SELECT COUNT(*) AS n FROM \`${db}\`.import_reject
        WHERE reject_reason = 'office_catalog_miss' AND id_lead = 1009
      `);
      const [[officeOk]] = await conn.query(`
        SELECT COUNT(*) AS n FROM \`${db}\`.\`lead\`
        WHERE glide_id = 1001 AND id_company_office = 81
      `);
      const [[missLead]] = await conn.query(`
        SELECT COUNT(*) AS n FROM \`${db}\`.\`lead\` WHERE glide_id = 1009
      `);
      const [[passengers]] = await conn.query(`
        SELECT COUNT(*) AS n FROM \`${db}\`.lead_party WHERE id_party_kind = 2
      `);

      assert.equal(Number(leads.n), 10);
      assert.ok(Number(clients.n) >= 10);
      assert.ok(Number(phones.n) >= 10);
      assert.ok(Number(parties.n) >= 11);
      assert.equal(Number(miss.n), 1);
      assert.equal(Number(officeOk.n), 1);
      assert.equal(Number(missLead.n), 1);
      assert.equal(Number(passengers.n), 1);
      assert.equal(await clientNameForLead(conn, db, 1001), "Ana");
    });
  });
});

describe("resume", () => {
  it("segunda corrida no duplica y avanza el watermark", async () => {
    const first = await migrateAll({ limit: 5 });
    assert.equal(first.migrated, 5);
    assert.equal(first.afterIdEnd, 1005);

    const second = await migrateAll({ resume: true });
    assert.equal(second.migrated, 5);
    assert.ok(second.afterIdEnd >= 1010);

    await withTarget(async (conn) => {
      const [[leads]] = await conn.query(`SELECT COUNT(*) AS n FROM \`${db}\`.\`lead\``);
      const [[glides]] = await conn.query(
        `SELECT COUNT(DISTINCT glide_id) AS n FROM \`${db}\`.\`lead\``
      );
      assert.equal(Number(leads.n), 10);
      assert.equal(Number(glides.n), 10);
    });
  });
});

async function remigrateOne(conn, glideId) {
  const [[kept]] = await conn.query(
    `SELECT l.id_lead, p.id_client
     FROM \`${db}\`.\`lead\` l
     INNER JOIN \`${db}\`.lead_party p ON p.id_lead = l.id_lead AND p.is_primary_party = 1
     WHERE l.glide_id = ?`,
    [glideId]
  );
  const preserveLeadIds = new Map([[glideId, Number(kept.id_lead)]]);
  await seedAccidentLocationTypes(conn);
  await seedSeverityLevels(conn);
  const maps = await loadCatalogMaps(conn);
  const [[row]] = await conn.query(
    `SELECT * FROM \`${db}\`.tblLeads_src WHERE idLead = ?`,
    [glideId]
  );
  await flushLeadBatch(conn, [transformLead(row, maps)], maps, { preserveLeadIds });
  return { idLead: Number(kept.id_lead), idClient: Number(kept.id_client) };
}

describe("incremental remigrate", () => {
  it("updated reciente se reescribe; lead viejo queda igual", async () => {
    await migrateAll();

    await withTarget(async (conn) => {
      const [[before]] = await conn.query(
        `SELECT l.id_lead, p.id_client
         FROM \`${db}\`.\`lead\` l
         INNER JOIN \`${db}\`.lead_party p ON p.id_lead = l.id_lead AND p.is_primary_party = 1
         WHERE l.glide_id = 1002`
      );
      await conn.query(
        `UPDATE \`${db}\`.tblLeads_src
         SET firstName = 'Roberto', updated = '2026-09-01 08:00:00'
         WHERE idLead = 1002`
      );
      const idLead = await remigrateOne(conn, 1002);
      assert.equal(idLead.idLead, Number(before.id_lead));
      assert.equal(idLead.idClient, Number(before.id_client));

      const [[after]] = await conn.query(
        `SELECT l.id_lead, p.id_client
         FROM \`${db}\`.\`lead\` l
         INNER JOIN \`${db}\`.lead_party p ON p.id_lead = l.id_lead AND p.is_primary_party = 1
         WHERE l.glide_id = 1002`
      );
      assert.equal(Number(after.id_lead), Number(before.id_lead));
      assert.equal(Number(after.id_client), Number(before.id_client));
      assert.equal(await clientNameForLead(conn, db, 1002), "Roberto");
      assert.equal(await clientNameForLead(conn, db, 1010), "Oldie");
      const [[leads]] = await conn.query(`SELECT COUNT(*) AS n FROM \`${db}\`.\`lead\``);
      assert.equal(Number(leads.n), 10);
    });
  });

  it("cambio de jerarquía en tblLeads refresca snapshot; g_users no interviene", async () => {
    await migrateAll();

    await withTarget(async (conn) => {
      const beforeOther = await orgSnapshotForLead(conn, db, 1010);
      assert.equal(beforeOther.office_code, "MIA");
      const [[before]] = await conn.query(
        `SELECT id_lead FROM \`${db}\`.\`lead\` WHERE glide_id = 1002`
      );

      await conn.query(
        `UPDATE \`${db}\`.tblLeads_src
         SET officeLabel = 'TPA', officeName = 'Tampa', office = 'tpa-office',
             region = 'region-south@nofault.com', regionName = 'South',
             pod = 'pod-b@nofault.com', podName = 'Pod B',
             team = 'team-2@nofault.com', teamName = 'Team 2',
             updated = '2026-09-01 09:00:00'
         WHERE idLead = 1002`
      );
      const kept = await remigrateOne(conn, 1002);
      assert.equal(kept.idLead, Number(before.id_lead));

      const snap = await orgSnapshotForLead(conn, db, 1002);
      assert.equal(snap.office_code, "TPA");
      assert.equal(Number(snap.id_company_office), 82);
      assert.equal(snap.office_name, "Tampa");
      assert.equal(snap.region, "region-south@nofault.com");
      assert.equal(snap.region_name, "South");
      assert.equal(snap.pod, "pod-b@nofault.com");
      assert.equal(snap.team, "team-2@nofault.com");

      const other = await orgSnapshotForLead(conn, db, 1010);
      assert.equal(other.office_code, "MIA");
      assert.equal(Number(other.id_company_office), 81);
    });
  });

  it("segunda corrida sin resume actualiza in-place y no duplica", async () => {
    await migrateAll();
    let idBefore;
    let clientBefore;
    let clientsBefore;
    await withTarget(async (conn) => {
      const [[row]] = await conn.query(
        `SELECT l.id_lead, p.id_client
         FROM \`${db}\`.\`lead\` l
         INNER JOIN \`${db}\`.lead_party p ON p.id_lead = l.id_lead AND p.is_primary_party = 1
         WHERE l.glide_id = 1001`
      );
      idBefore = Number(row.id_lead);
      clientBefore = Number(row.id_client);
      const [[clients]] = await conn.query(`SELECT COUNT(*) AS n FROM \`${db}\`.client`);
      clientsBefore = Number(clients.n);
      await conn.query(
        `UPDATE \`${db}\`.tblLeads_src SET firstName = 'Anita' WHERE idLead = 1001`
      );
    });

    await migrateAll();

    await withTarget(async (conn) => {
      const [[row]] = await conn.query(
        `SELECT l.id_lead, p.id_client
         FROM \`${db}\`.\`lead\` l
         INNER JOIN \`${db}\`.lead_party p ON p.id_lead = l.id_lead AND p.is_primary_party = 1
         WHERE l.glide_id = 1001`
      );
      assert.equal(Number(row.id_lead), idBefore);
      assert.equal(Number(row.id_client), clientBefore);
      assert.equal(await clientNameForLead(conn, db, 1001), "Anita");
      const [[leads]] = await conn.query(`SELECT COUNT(*) AS n FROM \`${db}\`.\`lead\``);
      const [[clients]] = await conn.query(`SELECT COUNT(*) AS n FROM \`${db}\`.client`);
      assert.equal(Number(leads.n), 10);
      assert.equal(Number(clients.n), clientsBefore);
    });
  });
});
