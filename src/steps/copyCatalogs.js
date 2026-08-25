const config = require('../config');
const { withTarget, withSource } = require('../db');
const { syncAttorneyCatalog } = require('../migration/attorneyCatalog');
const { syncTxLocationCatalog } = require('../migration/txLocationCatalog');
const { syncInsuranceCatalog } = require('../migration/insurance');
const { syncAtFaultTypeCatalog } = require('../migration/atFaultTypeCatalog');
const { seedAccidentLocationTypes } = require('../migration/accidentLocationTypeCatalog');
const { seedSeverityLevels } = require('../migration/severityLevelCatalog');
const { syncInjurySiteCatalog } = require('../migration/injurySiteCatalog');
const { loadStateMap } = require('../migration/state');
const {
  syncDepartmentsCatalog,
  syncRanksCatalog,
  syncJobTitlesCatalog,
} = require('../migration/userHrCatalog');
const {
  appendMissingOfficesFromGUsers,
  purgeCorOfficesFromCatalog,
} = require('../migration/officeCatalog');

async function copyCompanyCatalog(sourceConn, targetConn) {
  const src = config.source.database;
  const tgt = config.target.database;

  await targetConn.query('SET FOREIGN_KEY_CHECKS = 0');
  await targetConn.query(`TRUNCATE TABLE \`${tgt}\`.ref_company_office`);
  await targetConn.query(`TRUNCATE TABLE \`${tgt}\`.ref_company`);

  const [companies] = await sourceConn.query(
    `SELECT idcompany AS id_company, Description AS company_name FROM \`${src}\`.tblCompany`
  );
  if (companies.length) {
    const ph = companies.map(() => '(?, ?)').join(', ');
    await targetConn.query(
      `INSERT INTO \`${tgt}\`.ref_company (id_company, company_name) VALUES ${ph}`,
      companies.flatMap((r) => [r.id_company, r.company_name])
    );
  }
  console.log(`  ✓ ref_company: ${companies.length} filas`);

  const [offices] = await sourceConn.query(`
    SELECT idCompanyOffice AS id_company_office, idCompany AS id_company,
           officeName AS office_code, description AS display_name, capacity
    FROM \`${src}\`.tblCompanyOffices
    ORDER BY idCompanyOffice
  `);
  if (offices.length) {
    const ph = offices.map(() => '(?, ?, ?, ?, ?)').join(', ');
    await targetConn.query(
      `INSERT INTO \`${tgt}\`.ref_company_office
         (id_company_office, id_company, office_code, display_name, capacity)
       VALUES ${ph}`,
      offices.flatMap((r) => [
        r.id_company_office,
        r.id_company,
        r.office_code,
        r.display_name,
        r.capacity,
      ])
    );
  }
  console.log(`  ✓ ref_company_office: ${offices.length} filas (tblCompanyOffices)`);

  // Merge codes used in g_users.office (org / hierarchyRegion) missing from tblCompanyOffices
  // (legacy Office filter — e.g. 1800, CFL-LBA, CHI-AND, COL; excludes COR clinics).
  const defaultCompanyId =
    companies[0]?.id_company ?? offices[0]?.id_company ?? 1;
  const fromUsers = await appendMissingOfficesFromGUsers(sourceConn, targetConn, {
    defaultCompanyId,
  });
  if (fromUsers.added) {
    console.log(
      `  ✓ ref_company_office: +${fromUsers.added} desde g_users.office (${fromUsers.codes.join(', ')})`,
    );
  } else {
    console.log('  ✓ ref_company_office: sin códigos extra en g_users.office');
  }

  const purged = await purgeCorOfficesFromCatalog(targetConn);
  if (purged.removed) {
    console.log(
      `  ✓ ref_company_office: removidas ${purged.removed} clínicas COR (${purged.codes.join(', ')})`,
    );
  }
}

async function runCopyCatalogs({ dryRun = false } = {}) {
  if (!config.hasSeparateSource) {
    console.log('copy-catalogs: omitido (origen = destino; catálogos ya deben estar en destino)');
    return;
  }

  console.log(
    `Copiando catálogos ${config.source.database} → ${config.target.database}`
  );

  if (!config.sameServerAsTarget) {
    console.log('  Origen y destino en servidores distintos — copia por lotes');
  }

  if (dryRun) {
    console.log('  (dry-run) Se copiarían: ref_attorney, ref_tx_location, refTXLocations');
    return;
  }

  await withTarget(async (targetConn) => {
    await withSource(async (sourceConn) => {
      await copyCompanyCatalog(sourceConn, targetConn);
      const deptStats = await syncDepartmentsCatalog(sourceConn, targetConn);
      console.log(
        `  ✓ ref_department: ${deptStats.departments} filas${deptStats.seeded ? ' (seed)' : ''}`,
      );
      const rankStats = await syncRanksCatalog(sourceConn, targetConn);
      console.log(`  ✓ ref_rank: ${rankStats.ranks} filas`);
      const titleStats = await syncJobTitlesCatalog(sourceConn, targetConn);
      console.log(`  ✓ ref_job_title: ${titleStats.jobTitles} filas`);
      const stateMap = await loadStateMap(targetConn);
      const attorneyStats = await syncAttorneyCatalog(sourceConn, targetConn, stateMap);
      console.log(`  ✓ ref_attorney: ${attorneyStats.attorneys} (${attorneyStats.withState} con id_state)`);
      const txStats = await syncTxLocationCatalog(sourceConn, targetConn, stateMap);
      console.log(`  ✓ ref_tx_location: ${txStats.locations} (${txStats.withState} con id_state)`);
      const insStats = await syncInsuranceCatalog(sourceConn, targetConn, { truncate: true });
      console.log(`  ✓ ref_insurance_carrier: ${insStats.total} (${insStats.pip} PIP, ${insStats.atFault} AT_FAULT)`);
      await seedAccidentLocationTypes(targetConn);
      console.log('  ✓ ref_accident_location_type: 3 códigos (UNK/AFF/COR)');
      const aftStats = await syncAtFaultTypeCatalog(sourceConn, targetConn, { truncate: true });
      console.log(`  ✓ ref_at_fault_type: ${aftStats.total} tipos`);
      await seedSeverityLevels(targetConn);
      console.log('  ✓ ref_severity_level: 4 niveles (Mild…Major)');
      const injStats = await syncInjurySiteCatalog(sourceConn, targetConn, { truncate: true });
      console.log(`  ✓ ref_injury_site: ${injStats.total} sitios`);
    });
  });

  await withTarget(async (conn) => {
    await conn.query('SET FOREIGN_KEY_CHECKS = 1');
  });
}

module.exports = { runCopyCatalogs };
