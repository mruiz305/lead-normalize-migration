const config = require('../config');
const { bulkInsert, bulkInsertIgnore } = require('./bulkInsert');
const { withFullAudit, withTimelineAudit } = require('./leadAudit');
const { TYPE, resolveChannelTypeId } = require('./contactChannelTypes');
const { resolveAddressKindId, KIND } = require('./addressKind');
const STAFF_SUBMITTER = 1;
const STAFF_INTAKE = 2;
const STAFF_CREATOR = 3;
const STAFF_UPDATER = 4;
const PARTY_INJURED = 1;
const PARTY_CO_PASSENGER = 2;

const SYNC_FLAGS = [
  ['corProccesed', 'COR'],
  ['affProccesed', 'AFF'],
  ['attyProccesed', 'ATTY'],
  ['newLeadEmailProccesed', 'NEW_LEAD_EMAIL'],
  ['lockDownEmailProccesed', 'LOCKDOWN_EMAIL'],
  ['cameInEmailProccesed', 'CAME_IN_EMAIL'],
  ['droppedEmailProccesed', 'DROPPED_EMAIL'],
];

const PASSENGER_SLOTS = [
  { seq: 1, first: 'psngr1FirstName', last: 'psngr1LastName', dob: 'psngr1DOB', minor: 'psngr1IsMinor', phone: 'psngr1Phone', insurance: 'psngr1Insurance', txLoc: 'psngr1TXLoc', appt: 'psngr1AppDateTime', injuries: 'psngr1Injuries' },
  { seq: 2, first: 'psngr2FirstName', last: 'psngr2LastName', dob: 'psngr2DOB', minor: 'psngr2IsMinor', phone: 'psngr2Phone', insurance: 'psngr2Insurance', txLoc: 'psngr2TXLoc', appt: 'psngr2AppDateTime', injuries: 'psngr2Injuries' },
  { seq: 3, first: 'psngr3FirstName', last: 'psngr3LastName', dob: 'psngr3DOB2', minor: 'psngr3IsMinor', phone: 'psngr3Phone', insurance: 'psngr3Insurance', txLoc: 'psngr3TXLoc', appt: 'psngr3AppDateTime', injuries: 'psngr3Injuries' },
  { seq: 4, first: 'psngr4FirstName', last: 'psngr4LastName', dob: 'psngr4DOB', minor: 'psngr4IsMinor', phone: 'psngr4Phone', insurance: 'psngr4Insurance', txLoc: 'psngr4TXLoc', appt: 'psngr4AppDateTime', injuries: 'psngr4Injuries' },
  { seq: 5, first: 'psngr5FirstName', last: 'psngr5LastName', dob: 'psngr5DOB', minor: 'psngr5IsMinor', phone: 'psngr5Phone', insurance: 'psngr5Insurance', txLoc: 'psngr5TXLoc', appt: 'psngr5AppDateTime', injuries: 'psngr5Injuries' },
];

/** Columnas usadas por el transform (evita SELECT * con 189 cols) */
const LEAD_SELECT_COLUMNS = [
  'idLead', 'attorney', 'txLocation', 'leadStatus', 'clinicalStatus', 'legalStatus', 'stage', 'officeLabel',
  'directorate', 'directorateName', 'region', 'regionName', 'office', 'officeName',
  'pod', 'podName', 'team', 'teamName', 'duo', 'duoName',
  'submitter', 'creator', 'updater', 'intakeSpecialist', 'submitterName',
  'firstName', 'lastName', 'name', 'dob', 'isMinor', 'preferredLanguage', 'created', 'dateCreated',
  'phone', 'originalPhoneEntry', 'formattedPhoneEntry', 'email',
  'street', 'aptSuite', 'city', 'residencyState', 'zipCode',
  'referralSource', 'sourceType', 'internalSource', 'caseType', 'accidentOrWC',
  'isVIP', 'isHotLead', 'hotLeadStartTime', 'boostYN', 'confirmed', 'cnvValue',
  'cbID', 'cbIDNew', 'isCallBack', 'isCallBackNew', 'leadSortOrder', 'newLeads', 'idMedia', 'linkToLeadRecord',
  'intakeViewStepper', 'idAcc', 'idLeadOld', 'employer', 'requestedDrop', 'legacyLeadID', 'legacyCaseID', 'updated',
  'doa', 'accidentState', 'repState', 'locationType', 'atFaultType', 'atFaultSubType', 'vehicleModelYear',
  'propertyDamage', 'personalInjury', 'policeReport', 'drivingRideShare', 'psgInRideShare', 'passengerCount',
  'commercialPolicy', 'construction', 'Truck',
  'ticketAttorney', 'hasPrevAtty', 'prevAttyName', 'isNewAtty', 'dateLegalAccepted', 'dateLegalRejected',
  'signingDate', 'dateSigned', 'isDocuSigni',
  'isTeleMedicine', 'requiresTransportation', 'appointmentDateTime', 'visits', 'idot', 'ldot',
  'dateClinicalAccepted', 'dateClinicalRejected', 'pipInsurance', 'atfaultInsurance', 'hasUM',
  'injuries', 'fracture', 'ambulance', 'hospital', 'hospitalName', 'xray', 'mri', 'ctScans',
  'dateCameIn', 'dateLockedDown', 'dateDropped', 'callbackDateTime',
  'reasonPending', 'reasonDrop', 'otherDropReason', 'lkaDate',
  'corProccesed', 'affProccesed', 'attyProccesed', 'newLeadEmailProccesed', 'lockDownEmailProccesed',
  'cameInEmailProccesed', 'droppedEmailProccesed',
  'leadNotes', 'accidentNotes', 'hospitalNotes',
  ...PASSENGER_SLOTS.flatMap((s) => [s.first, s.last, s.dob, s.minor, s.phone, s.insurance, s.txLoc, s.appt, s.injuries]),
];

function trimOrNull(v) {
  if (v == null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

function bool(v) {
  return v ? 1 : 0;
}

/** Fecha mínima para client.created_at (NOT NULL) cuando origen no trae timestamps. */
function resolveCreatedAt(l, leadId, rejects) {
  for (const field of [
    'created', 'dateCreated', 'updated', 'dateCameIn', 'callbackDateTime', 'appointmentDateTime', 'doa',
  ]) {
    const v = l[field];
    if (v != null && String(v).trim() !== '') return v;
  }
  rejects.push([leadId, 'created', null, 'date_miss']);
  return new Date('1970-01-01T00:00:00.000Z');
}

function resolveUser(map, email, leadId, field, rejects) {
  const key = trimOrNull(email)?.toLowerCase();
  if (!key) return null;
  const id = map.get(key);
  if (id == null) rejects.push([leadId, field, email, 'user_miss']);
  return id ?? null;
}

function resolveFk(map, value, leadId, field, rejects) {
  const key = trimOrNull(value);
  if (!key) return null;
  const id = map.get(key);
  if (id == null) rejects.push([leadId, field, key, 'catalog_miss']);
  return id ?? null;
}

function resolveAttorneyFk(maps, value, leadId, field, rejects) {
  const key = trimOrNull(value);
  if (!key) return null;
  const id = maps.resolveAttorneyProfileId(key);
  if (!id) rejects.push([leadId, field, key, 'catalog_miss']);
  return id ?? null;
}

function resolvePrevAttorney(maps, value) {
  const key = trimOrNull(value);
  if (!key) return { id: null, name: null };
  const id = maps.resolveAttorneyProfileId(key);
  return { id, name: id ? null : key };
}

function resolveStage(maps, raw) {
  const s = trimOrNull(raw);
  if (!s) return null;
  const aliases = { Owened: 'Owned' };
  const code = aliases[s] ?? s;
  return maps.stageByCode.get(code) ?? null;
}

function resolveStateFk(maps, value, leadId, field, rejects) {
  const key = trimOrNull(value);
  if (!key) return null;
  const id = maps.resolveStateId(key);
  if (!id) rejects.push([leadId, field, key, 'state_miss']);
  return id;
}

function hasAddressParts(street, unit, city, stateRaw, zip) {
  return street || unit || city || stateRaw || zip;
}

function buildClientAddresses(l, maps, leadId, rejects) {
  const street = trimOrNull(l.street);
  const unit = trimOrNull(l.aptSuite);
  const city = trimOrNull(l.city);
  const stateRaw = trimOrNull(l.residencyState);
  const zip = trimOrNull(l.zipCode);
  if (!hasAddressParts(street, unit, city, stateRaw, zip)) return [];

  let idState = null;
  if (stateRaw) {
    idState = maps.resolveStateId(stateRaw);
    if (!idState) rejects.push([leadId, 'residencyState', stateRaw, 'state_miss']);
  }

  return [[
    resolveAddressKindId(maps, KIND.RESIDENCE),
    street, unit, city, idState, zip,
    null,
    1,
  ]];
}

function pushChannel(channels, maps, typeCode, value, label, isPrimary) {
  const v = trimOrNull(value);
  if (!v) return;
  channels.push([
    resolveChannelTypeId(maps, typeCode),
    v,
    label ?? null,
    isPrimary ? 1 : 0,
  ]);
}

function addPhoneChannels(channels, l, maps) {
  const phone = trimOrNull(l.phone);
  pushChannel(channels, maps, TYPE.PHONE_MOBILE, phone, null, true);
  const orig = trimOrNull(l.originalPhoneEntry);
  if (orig && orig !== phone) {
    pushChannel(channels, maps, TYPE.PHONE_INTAKE_RAW, orig, null, false);
  }
  const fmt = trimOrNull(l.formattedPhoneEntry);
  if (fmt && fmt !== phone && fmt !== orig) {
    pushChannel(channels, maps, TYPE.PHONE_INTAKE_FORMATTED, fmt, null, false);
  }
}

function hasPassengerData(l, slot) {
  return trimOrNull(l[slot.first]) || trimOrNull(l[slot.last]) || trimOrNull(l[slot.phone]);
}

function hasInjuryRow(l, siteTokens) {
  return (siteTokens && siteTokens.length > 0)
    || bool(l.fracture) || bool(l.ambulance) || bool(l.hospital)
    || trimOrNull(l.hospitalName)
    || bool(l.xray) || bool(l.mri) || bool(l.ctScans);
}

function transformLead(l, maps) {
  const rejects = [];
  const leadId = l.idLead;
  const createdAt = resolveCreatedAt(l, leadId, rejects);

  const idAttorney = resolveAttorneyFk(maps, l.attorney, leadId, 'attorney', rejects);
  const prevAttorney = resolvePrevAttorney(maps, l.prevAttyName);
  const idTx = resolveFk(maps.txByName, l.txLocation, leadId, 'tx_location', rejects);
  const idLeadStatus = maps.leadStatusByName.get(trimOrNull(l.leadStatus) || '') ?? null;
  const idClinical = maps.clinicalStatusByName.get(trimOrNull(l.clinicalStatus) || '') ?? null;
  const idLegal = maps.legalStatusByName.get(trimOrNull(l.legalStatus) || '') ?? null;
  const idStage = resolveStage(maps, l.stage);
  const officeCode = trimOrNull(l.officeLabel);
  const idCompanyOffice = officeCode ? maps.resolveCompanyOfficeId(officeCode) : null;
  if (officeCode && !idCompanyOffice) {
    rejects.push([leadId, 'officeLabel', officeCode, 'office_catalog_miss']);
  }

  const locationRaw = trimOrNull(l.locationType);
  let idLocationType = 1;
  if (locationRaw) {
    const loc = maps.resolveAccidentLocationTypeId(locationRaw);
    if (loc.id) {
      idLocationType = loc.id;
    } else {
      idLocationType = null;
      rejects.push([leadId, 'locationType', locationRaw, 'catalog_miss']);
    }
  }
  const atFaultTypeHit = maps.resolveAtFaultTypeId(l.atFaultType);
  const atFaultSubHit = maps.resolveAtFaultTypeId(l.atFaultSubType);
  const propertySev = maps.resolveSeverityId(l.propertyDamage);
  const personalSev = maps.resolveSeverityId(l.personalInjury);
  const injuryParsed = maps.parseInjuryField(l.injuries);
  let idPersonalSeverity = personalSev.id;
  let personalSeverityRaw = personalSev.raw;
  if (idPersonalSeverity == null && injuryParsed.severityFromInjury) {
    const fromInjury = maps.resolveSeverityId(injuryParsed.severityFromInjury);
    idPersonalSeverity = fromInjury.id;
    personalSeverityRaw = fromInjury.raw;
  }
  const injurySiteRaws = injuryParsed.siteTokens.map((token) => {
    const hit = maps.resolveInjurySiteId(token);
    return { token, id: hit.id };
  });
  const hasInjury = hasInjuryRow(l, injuryParsed.siteTokens);

  const insurance = [];
  const pip = maps.resolveCarrier(l.pipInsurance, maps.SCOPE_PIP);
  if (pip.raw) insurance.push([leadId, null, 'PIP', null, pip.raw, pip.id]);
  const atFault = maps.resolveCarrier(l.atfaultInsurance, maps.SCOPE_AT_FAULT);
  if (atFault.raw) insurance.push([leadId, null, 'AT_FAULT', null, atFault.raw, atFault.id]);

  const submitterUserId = resolveUser(maps.userByEmail, l.submitter, leadId, 'submitter', rejects);
  const creatorUserId = resolveUser(maps.userByEmail, l.creator, leadId, 'creator', rejects);
  const updaterUserId = resolveUser(maps.userByEmail, l.updater, leadId, 'updater', rejects);
  const intakeUserId = resolveUser(maps.userByEmail, l.intakeSpecialist, leadId, 'intakeSpecialist', rejects);

  const channels = [];
  addPhoneChannels(channels, l, maps);
  pushChannel(channels, maps, TYPE.EMAIL_PERSONAL, l.email, null, true);

  const staff = [];
  if (trimOrNull(l.submitter)) {
    staff.push([leadId, STAFF_SUBMITTER, submitterUserId, trimOrNull(l.submitter), trimOrNull(l.submitterName), l.created ?? createdAt]);
  }
  if (trimOrNull(l.intakeSpecialist)) {
    staff.push([leadId, STAFF_INTAKE, intakeUserId, trimOrNull(l.intakeSpecialist), null, l.created ?? createdAt]);
  }
  if (trimOrNull(l.creator) && trimOrNull(l.creator) !== trimOrNull(l.submitter)) {
    staff.push([leadId, STAFF_CREATOR, creatorUserId, trimOrNull(l.creator), null, l.created ?? createdAt]);
  }
  if (trimOrNull(l.updater) && trimOrNull(l.updater) !== trimOrNull(l.creator)) {
    staff.push([leadId, STAFF_UPDATER, updaterUserId, trimOrNull(l.updater), null, l.updated || l.created || createdAt]);
  }

  const syncFlags = [];
  for (const [col, code] of SYNC_FLAGS) {
    const val = trimOrNull(l[col]);
    if (val) syncFlags.push([leadId, code, val]);
  }

  const postedAt = l.created || l.dateCreated || createdAt;
  const postedBy = trimOrNull(l.creator) || trimOrNull(l.submitter);
  const postedByUserId = creatorUserId || submitterUserId;
  const notes = [];
  for (const [type, body] of [['intake', l.leadNotes], ['accident', l.accidentNotes], ['hospital', l.hospitalNotes]]) {
    const text = trimOrNull(body);
    if (text) notes.push([leadId, type, text, postedAt, postedBy, postedByUserId]);
  }

  const passengers = [];
  for (const slot of PASSENGER_SLOTS) {
    if (!hasPassengerData(l, slot)) continue;
    const psnTxId = resolveFk(maps.txByName, l[slot.txLoc], leadId, 'co_passenger_tx', rejects);
    const psnIns = maps.resolveCarrier(l[slot.insurance], maps.SCOPE_PIP);
    if (psnIns.raw) {
      insurance.push([leadId, null, 'PASSENGER', slot.seq, psnIns.raw, psnIns.id]);
    }
    const psnChannels = [];
    pushChannel(psnChannels, maps, TYPE.PHONE_MOBILE, l[slot.phone], null, true);
    const psnLinkedUserId = maps.resolveLinkedUserId(null, l[slot.phone]);
    const psnInjuryParsed = maps.parseInjuryField(l[slot.injuries]);
    const psnSev = psnInjuryParsed.severityFromInjury
      ? maps.resolveSeverityId(psnInjuryParsed.severityFromInjury)
      : { raw: null, id: null };
    const psnInjurySiteRaws = psnInjuryParsed.siteTokens.map((token) => {
      const hit = maps.resolveInjurySiteId(token);
      return { token, id: hit.id };
    });
    passengers.push({
      client: [
        trimOrNull(l[slot.first]), trimOrNull(l[slot.last]), l[slot.dob], bool(l[slot.minor]),
        createdAt, l.updated || l.created || createdAt, creatorUserId, updaterUserId ?? creatorUserId,
        psnLinkedUserId,
      ],
      channels: psnChannels,
      party: [leadId, null, PARTY_CO_PASSENGER, slot.seq, psnTxId, l[slot.appt], psnSev.id, 0],
      injurySiteRaws: psnInjurySiteRaws,
      personalSeverityRaw: psnSev.raw,
      slotSeq: slot.seq,
    });
  }

  const linkedUserId = maps.resolveLinkedUserId(l.email, l.phone);

  return {
    leadId,
    audit: {
      createdAt,
      updatedAt: l.updated || l.created || createdAt,
      createdByUserId: creatorUserId,
      updatedByUserId: updaterUserId ?? creatorUserId,
    },
    client: [
      trimOrNull(l.firstName), trimOrNull(l.lastName), trimOrNull(l.name), l.dob, bool(l.isMinor),
      trimOrNull(l.preferredLanguage), createdAt, l.updated || l.created || createdAt,
      creatorUserId, updaterUserId ?? creatorUserId, linkedUserId,
    ],
    channels,
    addresses: buildClientAddresses(l, maps, leadId, rejects),
    lead: [
      leadId, idLeadStatus, idStage, idCompanyOffice, submitterUserId,
      trimOrNull(l.referralSource), trimOrNull(l.sourceType), trimOrNull(l.internalSource),
      trimOrNull(l.caseType), trimOrNull(l.accidentOrWC),
      bool(l.isVIP), bool(l.isHotLead), l.hotLeadStartTime, bool(l.boostYN), bool(l.confirmed), l.cnvValue,
      trimOrNull(l.cbID), trimOrNull(l.cbIDNew), bool(l.isCallBack), bool(l.isCallBackNew),
      trimOrNull(l.leadSortOrder), l.newLeads, trimOrNull(l.idMedia), trimOrNull(l.linkToLeadRecord),
      trimOrNull(l.intakeViewStepper), l.idAcc, l.idLeadOld, trimOrNull(l.employer), l.requestedDrop,
      trimOrNull(l.legacyLeadID), trimOrNull(l.legacyCaseID),
      creatorUserId, l.created,
      updaterUserId, l.updated,
    ],
    accident: [
      leadId, l.doa,
      resolveStateFk(maps, l.accidentState, leadId, 'accidentState', rejects),
      resolveStateFk(maps, l.repState, leadId, 'repState', rejects),
      idLocationType,
      atFaultTypeHit.id, atFaultSubHit.id,
      trimOrNull(l.vehicleModelYear),
      propertySev.id, idPersonalSeverity,
      bool(l.policeReport), bool(l.drivingRideShare), bool(l.psgInRideShare), l.passengerCount,
      bool(l.commercialPolicy), bool(l.construction), bool(l.Truck),
    ],
    atFaultTypeRaw: atFaultTypeHit.raw,
    atFaultSubTypeRaw: atFaultSubHit.raw,
    propertySeverityRaw: propertySev.raw,
    personalSeverityRaw: personalSeverityRaw,
    legal: [
      leadId, idAttorney, idLegal, bool(l.ticketAttorney),
      prevAttorney.id ? 1 : bool(l.hasPrevAtty), prevAttorney.name, prevAttorney.id, bool(l.isNewAtty),
      l.dateLegalAccepted, l.dateLegalRejected, l.signingDate, l.dateSigned, bool(l.isDocuSigni),
    ],
    clinical: [
      leadId, idTx, idClinical, bool(l.isTeleMedicine), bool(l.requiresTransportation),
      l.appointmentDateTime, l.visits, l.idot, l.ldot,
      l.dateClinicalAccepted, l.dateClinicalRejected,
      bool(l.hasUM),
    ],
    injury: hasInjury ? [
      leadId, bool(l.fracture), bool(l.ambulance), bool(l.hospital),
      trimOrNull(l.hospitalName), bool(l.xray), bool(l.mri), bool(l.ctScans),
    ] : null,
    injurySiteRaws,
    timeline: [
      leadId, l.dateCreated, l.dateCameIn, l.dateLockedDown, l.dateDropped, l.callbackDateTime,
      trimOrNull(l.reasonPending), trimOrNull(l.reasonDrop), trimOrNull(l.otherDropReason), l.lkaDate,
    ],
    orgSnapshot: [
      leadId,
      trimOrNull(l.directorate),
      trimOrNull(l.directorateName),
      resolveUser(maps.userByEmail, l.directorate, leadId, 'org_directorate', rejects),
      trimOrNull(l.region),
      trimOrNull(l.regionName),
      resolveUser(maps.userByEmail, l.region, leadId, 'org_region', rejects),
      officeCode,
      idCompanyOffice,
      trimOrNull(l.officeName),
      trimOrNull(l.office),
      resolveUser(maps.userByEmail, l.office || officeCode, leadId, 'org_office', rejects),
      trimOrNull(l.pod),
      trimOrNull(l.podName),
      resolveUser(maps.userByEmail, l.pod, leadId, 'org_pod', rejects),
      trimOrNull(l.team),
      trimOrNull(l.teamName),
      resolveUser(maps.userByEmail, l.team, leadId, 'org_team', rejects),
      trimOrNull(l.duo),
      trimOrNull(l.duoName),
      resolveUser(maps.userByEmail, l.duo, leadId, 'org_duo', rejects),
    ],
    insurance,
    passengers,
    staff,
    syncFlags,
    notes,
    rejects,
  };
}

async function resolveInjurySiteIds(maps, items) {
  if (!maps.ensureInjurySite) return;
  for (const item of items) {
    if (!item.injurySiteRaws?.length) continue;
    item.injurySites = [];
    for (const entry of item.injurySiteRaws) {
      let id = entry.id;
      if (!id) id = await maps.ensureInjurySite(entry.token);
      if (id) item.injurySites.push([item.leadId, id]);
    }
  }
}

async function resolveAccidentCatalogIds(maps, items) {
  if (!maps.ensureAtFaultType && !maps.ensureSeverity) return;
  for (const item of items) {
    const row = item.accident;
    if (maps.ensureAtFaultType) {
      if (item.atFaultTypeRaw && row[5] == null) {
        row[5] = await maps.ensureAtFaultType(item.atFaultTypeRaw);
      }
      if (item.atFaultSubTypeRaw && row[6] == null) {
        row[6] = await maps.ensureAtFaultType(item.atFaultSubTypeRaw);
      }
    }
    if (maps.ensureSeverity) {
      if (item.propertySeverityRaw && row[8] == null) {
        row[8] = await maps.ensureSeverity(item.propertySeverityRaw);
      }
      if (item.personalSeverityRaw && row[9] == null) {
        row[9] = await maps.ensureSeverity(item.personalSeverityRaw);
      }
    }
  }
}

async function resolvePassengerCatalogIds(maps, psnMeta) {
  if (!maps.ensureSeverity && !maps.ensureInjurySite) return;
  for (const meta of psnMeta) {
    if (maps.ensureSeverity && meta.personalSeverityRaw && meta.party[6] == null) {
      meta.party[6] = await maps.ensureSeverity(meta.personalSeverityRaw);
    }
    if (!meta.injurySiteRaws?.length) continue;
    meta.injurySites = [];
    for (const entry of meta.injurySiteRaws) {
      let id = entry.id;
      if (!id && maps.ensureInjurySite) id = await maps.ensureInjurySite(entry.token);
      if (id) meta.injurySites.push(id);
    }
  }
}

async function resolveInsuranceCarrierIds(maps, insuranceRows) {
  if (!insuranceRows.length || !maps.ensureCarrier) return;
  for (const row of insuranceRows) {
    const raw = row[4];
    const role = row[2];
    if (raw && row[5] == null) {
      const scope = maps.scopeForInsuranceRole(role);
      row[5] = await maps.ensureCarrier(raw, scope);
    }
  }
}

async function flushLeadBatch(targetConn, items, maps) {
  if (!items.length) return;
  const db = config.target.database;

  const baseClientId = await bulkInsert(targetConn, db, 'client', [
    'first_name', 'last_name', 'display_name', 'date_of_birth', 'is_minor', 'preferred_language',
    'created_at', 'updated_at', 'created_by_user_id', 'updated_by_user_id', 'id_linked_user',
  ], items.map((i) => i.client));

  const channelRows = [];
  const addressRows = [];
  items.forEach((item, idx) => {
    const clientId = baseClientId + idx;
    item._clientId = clientId;
    const { createdAt, updatedAt, createdByUserId, updatedByUserId } = item.audit;
    for (const c of item.channels) {
      channelRows.push([clientId, ...c, createdAt, updatedAt, createdByUserId, updatedByUserId]);
    }
    for (const a of item.addresses) {
      addressRows.push([clientId, ...a, createdAt, updatedAt, createdByUserId, updatedByUserId]);
    }
  });

  await bulkInsertIgnore(targetConn, db, 'client_channel', [
    'id_client', 'id_channel_type', 'channel_value', 'channel_label', 'is_primary',
    'created_at', 'updated_at', 'created_by_user_id', 'updated_by_user_id',
  ], channelRows);
  if (addressRows.length) {
    await bulkInsert(targetConn, db, 'client_address', [
      'id_client', 'id_address_kind', 'street', 'unit', 'city', 'id_state', 'postal_code', 'address_label', 'is_primary',
      'created_at', 'updated_at', 'created_by_user_id', 'updated_by_user_id',
    ], addressRows);
  }

  await bulkInsert(targetConn, db, 'lead', [
    'id_lead', 'id_lead_status', 'id_stage', 'id_company_office', 'submitter_user_id',
    'referral_source', 'source_type', 'internal_source', 'case_type', 'accident_or_wc',
    'is_vip', 'is_hot_lead', 'hot_lead_start_at', 'boost_yn', 'confirmed', 'cnv_value',
    'callback_id', 'callback_id_new', 'is_callback', 'is_callback_new',
    'lead_sort_order', 'new_leads', 'id_media', 'link_to_lead_record', 'intake_view_stepper',
    'id_acc', 'id_lead_old', 'employer', 'requested_drop',
    'legacy_lead_id', 'legacy_case_id', 'created_by_user_id', 'created_at',
    'updated_by_user_id', 'updated_at',
  ], items.map((i) => i.lead));

  await bulkInsert(targetConn, db, 'lead_org_snapshot', [
    'id_lead',
    'directorate', 'directorate_name', 'directorate_user_id',
    'region', 'region_name', 'region_user_id',
    'office_code', 'id_company_office', 'office_name', 'office_legacy', 'office_user_id',
    'pod', 'pod_name', 'pod_user_id',
    'team', 'team_name', 'team_user_id',
    'duo', 'duo_name', 'duo_user_id',
    'created_at', 'updated_at', 'created_by_user_id', 'updated_by_user_id',
  ], items.map((i) => withFullAudit(i.orgSnapshot, i.audit)));

  await resolveAccidentCatalogIds(maps, items);

  await bulkInsert(targetConn, db, 'lead_accident', [
    'id_lead', 'date_of_accident', 'id_accident_state', 'id_rep_state', 'id_location_type',
    'id_at_fault_type', 'id_at_fault_sub_type', 'vehicle_description', 'id_property_severity', 'id_personal_severity',
    'police_report', 'driving_rideshare', 'passenger_in_rideshare', 'passenger_count',
    'commercial_policy', 'construction', 'truck',
    'created_at', 'updated_at', 'created_by_user_id', 'updated_by_user_id',
  ], items.map((i) => withFullAudit(i.accident, i.audit)));

  await bulkInsert(targetConn, db, 'lead_legal', [
    'id_lead', 'id_attorney', 'id_legal_status', 'ticket_attorney',
    'has_prev_attorney', 'prev_attorney_name', 'id_prev_attorney', 'is_new_attorney',
    'date_legal_accepted', 'date_legal_rejected', 'signing_at', 'date_signed', 'is_docusign',
    'created_at', 'updated_at', 'created_by_user_id', 'updated_by_user_id',
  ], items.map((i) => withFullAudit(i.legal, i.audit)));

  await bulkInsert(targetConn, db, 'lead_clinical', [
    'id_lead', 'id_tx_location', 'id_clinical_status', 'is_telemedicine', 'requires_transportation',
    'appointment_at', 'visits', 'idot', 'ldot', 'date_clinical_accepted', 'date_clinical_rejected',
    'has_um',
    'created_at', 'updated_at', 'created_by_user_id', 'updated_by_user_id',
  ], items.map((i) => withFullAudit(i.clinical, i.audit)));

  const injuryItems = items.filter((i) => i.injury);
  if (injuryItems.length) {
    await bulkInsert(targetConn, db, 'lead_injury', [
      'id_lead', 'fracture', 'ambulance', 'hospital', 'hospital_name', 'xray', 'mri', 'ct_scans',
      'created_at', 'updated_at', 'created_by_user_id', 'updated_by_user_id',
    ], injuryItems.map((i) => withFullAudit(i.injury, i.audit)));
  }

  await resolveInjurySiteIds(maps, items);
  const injurySiteRows = items.flatMap((i) => (i.injurySites || []).map((site) => withFullAudit(site, i.audit)));
  if (injurySiteRows.length) {
    await bulkInsertIgnore(targetConn, db, 'lead_injury_site', [
      'id_lead', 'id_injury_site', 'created_at', 'updated_at', 'created_by_user_id', 'updated_by_user_id',
    ], injurySiteRows);
  }

  await bulkInsert(targetConn, db, 'lead_timeline', [
    'id_lead', 'date_created', 'date_came_in', 'date_locked_down', 'date_dropped', 'callback_at',
    'reason_pending', 'reason_drop', 'other_drop_reason', 'lka_date',
    'created_at', 'updated_at',
  ], items.map((i) => withTimelineAudit(i.timeline, i.audit)));

  await bulkInsert(targetConn, db, 'lead_party', [
    'id_lead', 'id_client', 'id_party_kind', 'party_sequence', 'is_primary_party',
    'created_at', 'updated_at', 'created_by_user_id', 'updated_by_user_id',
  ], items.map((i) => withFullAudit([i.leadId, i._clientId, PARTY_INJURED, null, 1], i.audit)));

  const psnClients = [];
  const psnMeta = [];
  for (const item of items) {
    for (const psn of item.passengers) {
      psnMeta.push({ ...psn, audit: item.audit });
      psnClients.push(psn.client);
    }
  }
  if (psnClients.length) {
    await resolvePassengerCatalogIds(maps, psnMeta);
    const psnBaseId = await bulkInsert(targetConn, db, 'client', [
      'first_name', 'last_name', 'date_of_birth', 'is_minor',
      'created_at', 'updated_at', 'created_by_user_id', 'updated_by_user_id', 'id_linked_user',
    ], psnClients);
    const psnChannels = [];
    const psnParties = [];
    psnMeta.forEach((meta, idx) => {
      const clientId = psnBaseId + idx;
      const a = meta.audit;
      for (const c of meta.channels) {
        psnChannels.push([clientId, ...c, a.createdAt, a.updatedAt, a.createdByUserId, a.updatedByUserId]);
      }
      psnParties.push(withFullAudit([meta.party[0], clientId, ...meta.party.slice(2)], meta.audit));
    });
    await bulkInsertIgnore(targetConn, db, 'client_channel', [
      'id_client', 'id_channel_type', 'channel_value', 'channel_label', 'is_primary',
      'created_at', 'updated_at', 'created_by_user_id', 'updated_by_user_id',
    ], psnChannels);
    const psnPartyBaseId = await bulkInsert(targetConn, db, 'lead_party', [
      'id_lead', 'id_client', 'id_party_kind', 'party_sequence', 'id_tx_location', 'appointment_at', 'id_personal_severity', 'is_primary_party',
      'created_at', 'updated_at', 'created_by_user_id', 'updated_by_user_id',
    ], psnParties);

    const partyIdByLeadSeq = new Map();
    psnMeta.forEach((meta, idx) => {
      partyIdByLeadSeq.set(`${meta.party[0]}:${meta.slotSeq}`, psnPartyBaseId + idx);
    });

    const partyInjurySiteRows = [];
    psnMeta.forEach((meta, idx) => {
      const partyId = psnPartyBaseId + idx;
      const a = meta.audit;
      for (const siteId of meta.injurySites || []) {
        partyInjurySiteRows.push([partyId, siteId, a.createdAt, a.updatedAt, a.createdByUserId, a.updatedByUserId]);
      }
    });
    if (partyInjurySiteRows.length) {
      await bulkInsertIgnore(targetConn, db, 'lead_party_injury_site', [
        'id_lead_party', 'id_injury_site', 'created_at', 'updated_at', 'created_by_user_id', 'updated_by_user_id',
      ], partyInjurySiteRows);
    }

    for (const item of items) {
      for (const row of item.insurance) {
        if (row[2] !== 'PASSENGER') continue;
        const partyId = partyIdByLeadSeq.get(`${row[0]}:${row[3]}`);
        if (partyId) row[1] = partyId;
      }
    }
  }

  const staffRows = items.flatMap((i) => i.staff.map((r) => [...withFullAudit(r, i.audit), 1]));
  if (staffRows.length) {
    await bulkInsert(targetConn, db, 'lead_staff', [
      'id_lead', 'id_staff_kind', 'id_user', 'staff_key', 'staff_display_name', 'assigned_at',
      'created_at', 'updated_at', 'created_by_user_id', 'updated_by_user_id', 'is_active',
    ], staffRows);
  }

  const syncRows = items.flatMap((i) => i.syncFlags.map((row) => withFullAudit(row, i.audit)));
  if (syncRows.length) {
    const colList = 'id_lead, flag_code, flag_value, created_at, updated_at, created_by_user_id, updated_by_user_id';
    const ph = syncRows.map(() => '(?, ?, ?, ?, ?, ?, ?)').join(', ');
    await targetConn.query(
      `INSERT INTO \`${db}\`.lead_sync_flag (${colList}) VALUES ${ph}
       ON DUPLICATE KEY UPDATE flag_value = VALUES(flag_value),
         updated_at = VALUES(updated_at),
         updated_by_user_id = VALUES(updated_by_user_id)`,
      syncRows.flat()
    );
  }

  const noteRows = items.flatMap((i) => i.notes);
  if (noteRows.length) {
    await bulkInsert(targetConn, db, 'lead_note', [
      'id_lead', 'note_type', 'body', 'posted_at', 'posted_by', 'posted_by_user_id',
    ], noteRows);
  }

  const insuranceRows = items.flatMap((i) => i.insurance.map((row) => withFullAudit(row, i.audit)));
  if (insuranceRows.length) {
    await resolveInsuranceCarrierIds(maps, insuranceRows);
    await bulkInsert(targetConn, db, 'lead_insurance', [
      'id_lead', 'id_lead_party', 'insurance_role', 'party_sequence', 'carrier_raw', 'id_carrier',
      'created_at', 'updated_at', 'created_by_user_id', 'updated_by_user_id',
    ], insuranceRows);
  }

  const rejectRows = items.flatMap((i) => i.rejects);
  if (rejectRows.length) {
    await bulkInsert(targetConn, db, 'import_reject', [
      'id_lead', 'field_name', 'raw_value', 'reject_reason',
    ], rejectRows);
  }
}

async function migrateOneLead(targetConn, l, maps) {
  await flushLeadBatch(targetConn, [transformLead(l, maps)], maps);
}

async function getResumeWatermark(targetConn) {
  const db = config.target.database;
  const [[row]] = await targetConn.query(
    `SELECT COALESCE(MAX(id_lead), 0) AS maxId FROM \`${db}\`.\`lead\``
  );
  return Number(row.maxId);
}

async function runMigration(sourceConn, targetConn, maps, {
  batchSize = 200,
  limit = null,
  resume = false,
  fromId = null,
  onProgress,
} = {}) {
  const leadsSql = config.sourceLeads.sql;
  const leadsConn = config.sourceLeads.onTarget ? targetConn : sourceConn;
  const colList = LEAD_SELECT_COLUMNS.map((c) => `\`${c}\``).join(', ');
  const [[{ sourceTotal }]] = await leadsConn.query(
    `SELECT COUNT(*) AS total FROM ${leadsSql}`
  );

  let afterId = 0;
  if (resume || fromId != null) {
    const watermark = await getResumeWatermark(targetConn);
    afterId = fromId != null ? Number(fromId) : watermark;
    if (fromId != null && Number(fromId) < watermark) {
      throw new Error(
        `--from-id ${fromId} es menor que MAX(id_lead) en destino (${watermark}). Usa --resume sin --from-id.`
      );
    }
  }

  const [[{ pendingTotal }]] = await leadsConn.query(
    `SELECT COUNT(*) AS pendingTotal FROM ${leadsSql} WHERE idLead > ?`,
    [afterId]
  );
  const cap = limit ? Math.min(limit, pendingTotal) : pendingTotal;

  if (cap === 0) {
    return {
      total: 0,
      migrated: 0,
      sourceTotal,
      pendingTotal,
      afterId,
      afterIdEnd: afterId,
      resume,
    };
  }

  let migrated = 0;
  let cursor = afterId;

  while (migrated < cap) {
    const take = Math.min(batchSize, cap - migrated);
    const [rows] = await leadsConn.query(
      `SELECT ${colList} FROM ${leadsSql}
       WHERE idLead > ? ORDER BY idLead LIMIT ?`,
      [cursor, take]
    );
    if (rows.length === 0) break;

    const transformed = rows.map((row) => transformLead(row, maps));
    await targetConn.beginTransaction();
    try {
      await flushLeadBatch(targetConn, transformed, maps);
      await targetConn.commit();
    } catch (err) {
      await targetConn.rollback();
      throw new Error(`Batch after idLead ${cursor}: ${err.message}`);
    }
    cursor = rows[rows.length - 1].idLead;
    migrated += rows.length;
    if (onProgress) onProgress(migrated, cap);
  }

  return {
    total: cap,
    migrated,
    sourceTotal,
    pendingTotal,
    afterId,
    afterIdEnd: cursor,
    resume: resume || afterId > 0,
  };
}

module.exports = {
  migrateOneLead,
  runMigration,
  getResumeWatermark,
  transformLead,
  flushLeadBatch,
  LEAD_SELECT_COLUMNS,
};
