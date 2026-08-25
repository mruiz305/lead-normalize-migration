const config = require('../config');
const { loadCarrierMap } = require('./insurance');
const { loadCompanyOfficeMap } = require('./officeCatalog');
const { loadContactChannelTypeMap } = require('./contactChannelTypes');
const { loadStateMap, resolveStateId } = require('./state');
const { loadAddressKindMap } = require('./addressKind');
const { loadAttorneyMap } = require('./attorneyCatalog');
const { loadTxLocationMap } = require('./txLocationCatalog');
const { loadAtFaultTypeMap } = require('./atFaultTypeCatalog');
const { loadAccidentLocationTypeMap } = require('./accidentLocationTypeCatalog');
const { loadSeverityMap } = require('./severityLevelCatalog');
const { loadInjurySiteMap } = require('./injurySiteCatalog');
const { createLinkedUserResolver, buildUserLookup } = require('./clientLink');

function rowMap(rows, keyCol, valCol) {
  const m = new Map();
  for (const r of rows) {
    const k = r[keyCol];
    if (k == null || String(k).trim() === '') continue;
    m.set(String(k).trim(), r[valCol]);
  }
  return m;
}

async function loadCatalogMaps(targetConn) {
  const db = config.target.database;

  const [attorneys] = await targetConn.query(
    `SELECT id_attorney, display_name FROM \`${db}\`.ref_attorney WHERE display_name IS NOT NULL`
  );
  const [txLocs] = await targetConn.query(
    `SELECT id_tx_location, display_name FROM \`${db}\`.ref_tx_location WHERE display_name IS NOT NULL`
  );
  const [leadSt] = await targetConn.query(
    `SELECT idLeadStatus, leadStatus FROM \`${db}\`.refLeadStatus`
  );
  const [clinicalSt] = await targetConn.query(
    `SELECT idClinicalStatus, clinicalStatus FROM \`${db}\`.refClinicalStatus`
  );
  const [legalSt] = await targetConn.query(
    `SELECT idLegalStatus, legalStatus FROM \`${db}\`.refLegalStatus`
  );
  const [stages] = await targetConn.query(
    `SELECT id_stage, stage_code FROM \`${db}\`.ref_lead_stage`
  );
  const [users] = await targetConn.query(
    `SELECT id_user, LOWER(TRIM(email)) AS email, phone FROM \`${db}\`.app_user`
  );

  const userByEmail = new Map();
  for (const u of users) {
    if (u.email && !userByEmail.has(u.email)) userByEmail.set(u.email, u.id_user);
  }
  const { userByPhone } = buildUserLookup(users);
  const resolveLinkedUserId = createLinkedUserResolver(userByEmail, userByPhone);

  const carrier = await loadCarrierMap(targetConn);
  const officeCatalog = await loadCompanyOfficeMap(targetConn);
  const contactChannel = await loadContactChannelTypeMap(targetConn);
  const stateMap = await loadStateMap(targetConn);
  const addressKind = await loadAddressKindMap(targetConn);
  const attorney = await loadAttorneyMap(targetConn);
  const tx = await loadTxLocationMap(targetConn);
  const atFault = await loadAtFaultTypeMap(targetConn);
  const accidentLocation = await loadAccidentLocationTypeMap(targetConn);
  const severity = await loadSeverityMap(targetConn);
  const injurySite = await loadInjurySiteMap(targetConn);

  return {
    attorneyByName: rowMap(attorneys, 'display_name', 'id_attorney'),
    resolveAttorneyId: attorney.resolveAttorneyId,
    resolveAttorneyProfileId: attorney.resolveAttorneyId,
    txByName: rowMap(txLocs, 'display_name', 'id_tx_location'),
    resolveTxLocationId: tx.resolveTxLocationId,
    leadStatusByName: rowMap(leadSt, 'leadStatus', 'idLeadStatus'),
    clinicalStatusByName: rowMap(clinicalSt, 'clinicalStatus', 'idClinicalStatus'),
    legalStatusByName: rowMap(legalSt, 'legalStatus', 'idLegalStatus'),
    stageByCode: rowMap(stages, 'stage_code', 'id_stage'),
    companyOfficeByCode: officeCatalog.companyOfficeByCode,
    resolveCompanyOfficeId: officeCatalog.resolveCompanyOfficeId,
    userByEmail,
    resolveLinkedUserId,
    carrierByKey: carrier.carrierByKey,
    resolveCarrier: carrier.resolveCarrier,
    ensureCarrier: carrier.ensureCarrier,
    scopeForInsuranceRole: carrier.scopeForInsuranceRole,
    SCOPE_PIP: carrier.SCOPE_PIP,
    SCOPE_AT_FAULT: carrier.SCOPE_AT_FAULT,
    channelTypeByCode: contactChannel.channelTypeByCode,
    channelTypesByMedium: contactChannel.channelTypesByMedium,
    stateByName: stateMap.stateByName,
    stateByCode: stateMap.stateByCode,
    addressKindByCode: addressKind.addressKindByCode,
    resolveStateId: (text) => resolveStateId(stateMap, text),
    resolveAtFaultTypeId: atFault.resolveAtFaultTypeId,
    ensureAtFaultType: atFault.ensureAtFaultType,
    resolveAccidentLocationTypeId: accidentLocation.resolveAccidentLocationTypeId,
    resolveSeverityId: severity.resolveSeverityId,
    ensureSeverity: severity.ensureSeverity,
    parseInjuryField: injurySite.parseInjuryField,
    resolveInjurySiteId: injurySite.resolveInjurySiteId,
    ensureInjurySite: injurySite.ensureInjurySite,
  };
}

module.exports = { loadCatalogMaps, rowMap };
