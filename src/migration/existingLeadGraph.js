const { bulkInsert, bulkInsertIgnore, bulkUpdateByPk } = require('./bulkInsert');
const { withFullAudit } = require('./leadAudit');

const PARTY_INJURED = 1;
const PARTY_CO_PASSENGER = 2;
const GLIDE_NOTE_TYPES = ['intake', 'accident', 'hospital'];

function ph(ids) {
  return ids.map(() => '?').join(',');
}

function emptyGraph() {
  return {
    primaryByLead: new Map(),
    passengerByLeadSeq: new Map(),
    staffByLeadKind: new Map(),
    insByLeadRoleSeq: new Map(),
    noteByLeadType: new Map(),
    rejectByLeadField: new Map(),
    addressByClientKind: new Map(),
    channelByClientType: new Map(),
  };
}

function rememberFirst(map, key, value) {
  if (!map.has(key)) map.set(key, value);
}

async function loadExistingLeadGraph(conn, db, leadIds) {
  const g = emptyGraph();
  if (!leadIds.length) return g;

  const leadPh = ph(leadIds);
  const [parties] = await conn.query(
    `SELECT id_lead_party, id_lead, id_client, id_party_kind, party_sequence, is_primary_party
     FROM \`${db}\`.lead_party WHERE id_lead IN (${leadPh})
     ORDER BY id_lead_party`,
    leadIds
  );
  for (const p of parties) {
    const leadId = Number(p.id_lead);
    const kind = Number(p.id_party_kind);
    if (Number(p.is_primary_party) === 1 && kind === PARTY_INJURED) {
      rememberFirst(g.primaryByLead, leadId, p);
    }
    if (kind === PARTY_CO_PASSENGER && p.party_sequence != null) {
      rememberFirst(g.passengerByLeadSeq, `${leadId}:${Number(p.party_sequence)}`, p);
    }
  }

  const clientIds = [...new Set(parties.map((p) => Number(p.id_client)))];

  const [staff] = await conn.query(
    `SELECT id_lead_staff, id_lead, id_staff_kind FROM \`${db}\`.lead_staff
     WHERE id_lead IN (${leadPh}) ORDER BY id_lead_staff`,
    leadIds
  );
  for (const r of staff) {
    rememberFirst(g.staffByLeadKind, `${Number(r.id_lead)}:${Number(r.id_staff_kind)}`, Number(r.id_lead_staff));
  }

  const [ins] = await conn.query(
    `SELECT id_lead_insurance, id_lead, insurance_role, party_sequence
     FROM \`${db}\`.lead_insurance WHERE id_lead IN (${leadPh})
     ORDER BY id_lead_insurance`,
    leadIds
  );
  for (const r of ins) {
    const seq = r.party_sequence == null ? '' : Number(r.party_sequence);
    rememberFirst(g.insByLeadRoleSeq, `${Number(r.id_lead)}:${r.insurance_role}:${seq}`, Number(r.id_lead_insurance));
  }

  const [notes] = await conn.query(
    `SELECT id_note, id_lead, note_type FROM \`${db}\`.lead_note
     WHERE id_lead IN (${leadPh}) AND note_type IN (${GLIDE_NOTE_TYPES.map(() => '?').join(',')})
     ORDER BY id_note`,
    [...leadIds, ...GLIDE_NOTE_TYPES]
  );
  for (const r of notes) {
    rememberFirst(g.noteByLeadType, `${Number(r.id_lead)}:${r.note_type}`, Number(r.id_note));
  }

  const [rejects] = await conn.query(
    `SELECT id_reject, id_lead, field_name FROM \`${db}\`.import_reject
     WHERE id_lead IN (${leadPh}) ORDER BY id_reject`,
    leadIds
  );
  for (const r of rejects) {
    rememberFirst(g.rejectByLeadField, `${Number(r.id_lead)}:${r.field_name}`, Number(r.id_reject));
  }

  if (clientIds.length) {
    const cPh = ph(clientIds);
    const [addrs] = await conn.query(
      `SELECT id_address, id_client, id_address_kind FROM \`${db}\`.client_address
       WHERE id_client IN (${cPh}) ORDER BY id_address`,
      clientIds
    );
    for (const r of addrs) {
      rememberFirst(g.addressByClientKind, `${Number(r.id_client)}:${Number(r.id_address_kind)}`, Number(r.id_address));
    }

    const [channels] = await conn.query(
      `SELECT id_channel, id_client, id_channel_type, is_primary FROM \`${db}\`.client_channel
       WHERE id_client IN (${cPh}) ORDER BY is_primary DESC, id_channel`,
      clientIds
    );
    for (const r of channels) {
      rememberFirst(g.channelByClientType, `${Number(r.id_client)}:${Number(r.id_channel_type)}`, Number(r.id_channel));
    }
  }

  return g;
}

async function upsertPrimaryPeople(conn, db, items, graph) {
  const toUpdate = [];
  const toInsert = [];
  for (const item of items) {
    const existing = graph.primaryByLead.get(item._leadId);
    if (existing) {
      item._clientId = Number(existing.id_client);
      item._partyId = Number(existing.id_lead_party);
      toUpdate.push(item);
    } else {
      toInsert.push(item);
    }
  }

  if (toUpdate.length) {
    await bulkUpdateByPk(conn, db, 'client', 'id_client', [
      'first_name', 'last_name', 'display_name', 'date_of_birth', 'is_minor', 'preferred_language',
      'updated_at', 'updated_by_user_id', 'id_linked_user',
    ], toUpdate.map((i) => {
      const c = i.client;
      return [i._clientId, c[0], c[1], c[2], c[3], c[4], c[5], c[7], c[9], c[10]];
    }));
  }

  if (toInsert.length) {
    const base = await bulkInsert(conn, db, 'client', [
      'first_name', 'last_name', 'display_name', 'date_of_birth', 'is_minor', 'preferred_language',
      'created_at', 'updated_at', 'created_by_user_id', 'updated_by_user_id', 'id_linked_user',
    ], toInsert.map((i) => i.client));
    let next = base;
    for (const item of toInsert) item._clientId = next++;
  }

  const partyInserts = items.filter((i) => !i._partyId);
  if (partyInserts.length) {
    const base = await bulkInsert(conn, db, 'lead_party', [
      'id_lead', 'id_client', 'id_party_kind', 'party_sequence', 'is_primary_party',
      'created_at', 'updated_at', 'created_by_user_id', 'updated_by_user_id',
    ], partyInserts.map((i) => withFullAudit([i._leadId, i._clientId, PARTY_INJURED, null, 1], i.audit)));
    let next = base;
    for (const item of partyInserts) item._partyId = next++;
  }
}

async function upsertClientContacts(conn, db, bindings, graph) {
  const chUpdate = [];
  const chInsert = [];
  const adUpdate = [];
  const adInsert = [];

  for (const b of bindings) {
    const { createdAt, updatedAt, createdByUserId, updatedByUserId } = b.audit;
    for (const c of b.channels || []) {
      const [type, value, label, isPrimary] = c;
      const existingId = graph.channelByClientType.get(`${b.clientId}:${Number(type)}`);
      if (existingId) {
        chUpdate.push([existingId, value, label, isPrimary, updatedAt, updatedByUserId]);
      } else {
        chInsert.push([b.clientId, type, value, label, isPrimary, createdAt, updatedAt, createdByUserId, updatedByUserId]);
      }
    }
    for (const a of b.addresses || []) {
      const [kind, street, unit, city, idState, zip, label, isPrimary] = a;
      const existingId = graph.addressByClientKind.get(`${b.clientId}:${Number(kind)}`);
      if (existingId) {
        adUpdate.push([existingId, street, unit, city, idState, zip, label, isPrimary, updatedAt, updatedByUserId]);
      } else {
        adInsert.push([
          b.clientId, kind, street, unit, city, idState, zip, label, isPrimary,
          createdAt, updatedAt, createdByUserId, updatedByUserId,
        ]);
      }
    }
  }

  await bulkUpdateByPk(conn, db, 'client_channel', 'id_channel', [
    'channel_value', 'channel_label', 'is_primary', 'updated_at', 'updated_by_user_id',
  ], chUpdate);
  await bulkInsertIgnore(conn, db, 'client_channel', [
    'id_client', 'id_channel_type', 'channel_value', 'channel_label', 'is_primary',
    'created_at', 'updated_at', 'created_by_user_id', 'updated_by_user_id',
  ], chInsert);

  await bulkUpdateByPk(conn, db, 'client_address', 'id_address', [
    'street', 'unit', 'city', 'id_state', 'postal_code', 'address_label', 'is_primary',
    'updated_at', 'updated_by_user_id',
  ], adUpdate);
  if (adInsert.length) {
    await bulkInsert(conn, db, 'client_address', [
      'id_client', 'id_address_kind', 'street', 'unit', 'city', 'id_state', 'postal_code', 'address_label', 'is_primary',
      'created_at', 'updated_at', 'created_by_user_id', 'updated_by_user_id',
    ], adInsert);
  }
}

async function upsertPassengers(conn, db, items, graph, resolvePassengerCatalogIds, maps) {
  const psnMeta = [];
  for (const item of items) {
    for (const psn of item.passengers || []) {
      psnMeta.push({ ...psn, audit: item.audit, leadId: item._leadId });
    }
  }
  const partyIdByLeadSeq = new Map();
  if (!psnMeta.length) return partyIdByLeadSeq;

  await resolvePassengerCatalogIds(maps, psnMeta);

  const toUpdate = [];
  const toInsert = [];
  for (const meta of psnMeta) {
    const existing = graph.passengerByLeadSeq.get(`${meta.leadId}:${meta.slotSeq}`);
    if (existing) {
      meta._clientId = Number(existing.id_client);
      meta._partyId = Number(existing.id_lead_party);
      toUpdate.push(meta);
    } else {
      toInsert.push(meta);
    }
  }

  if (toUpdate.length) {
    await bulkUpdateByPk(conn, db, 'client', 'id_client', [
      'first_name', 'last_name', 'date_of_birth', 'is_minor',
      'updated_at', 'updated_by_user_id', 'id_linked_user',
    ], toUpdate.map((m) => {
      const c = m.client;
      return [m._clientId, c[0], c[1], c[2], c[3], c[5], c[7], c[8]];
    }));
    await bulkUpdateByPk(conn, db, 'lead_party', 'id_lead_party', [
      'id_tx_location', 'appointment_at', 'id_personal_severity', 'updated_at', 'updated_by_user_id',
    ], toUpdate.map((m) => {
      const p = m.party;
      return [m._partyId, p[4], p[5], p[6], m.audit.updatedAt, m.audit.updatedByUserId];
    }));
  }

  if (toInsert.length) {
    const baseClient = await bulkInsert(conn, db, 'client', [
      'first_name', 'last_name', 'date_of_birth', 'is_minor',
      'created_at', 'updated_at', 'created_by_user_id', 'updated_by_user_id', 'id_linked_user',
    ], toInsert.map((m) => m.client));
    let nextClient = baseClient;
    for (const meta of toInsert) meta._clientId = nextClient++;

    const parties = toInsert.map((m) =>
      withFullAudit([m.party[0], m._clientId, ...m.party.slice(2)], m.audit)
    );
    const baseParty = await bulkInsert(conn, db, 'lead_party', [
      'id_lead', 'id_client', 'id_party_kind', 'party_sequence', 'id_tx_location', 'appointment_at',
      'id_personal_severity', 'is_primary_party',
      'created_at', 'updated_at', 'created_by_user_id', 'updated_by_user_id',
    ], parties);
    let nextParty = baseParty;
    for (const meta of toInsert) meta._partyId = nextParty++;
  }

  for (const meta of psnMeta) {
    partyIdByLeadSeq.set(`${meta.party[0]}:${meta.slotSeq}`, meta._partyId);
  }

  await upsertClientContacts(conn, db, psnMeta.map((m) => ({
    clientId: m._clientId,
    channels: m.channels,
    addresses: [],
    audit: m.audit,
  })), graph);

  const partyInjurySiteRows = [];
  for (const meta of psnMeta) {
    const a = meta.audit;
    for (const siteId of meta.injurySites || []) {
      partyInjurySiteRows.push([
        meta._partyId, siteId, a.createdAt, a.updatedAt, a.createdByUserId, a.updatedByUserId,
      ]);
    }
  }
  if (partyInjurySiteRows.length) {
    await bulkInsertIgnore(conn, db, 'lead_party_injury_site', [
      'id_lead_party', 'id_injury_site', 'created_at', 'updated_at', 'created_by_user_id', 'updated_by_user_id',
    ], partyInjurySiteRows);
  }

  return partyIdByLeadSeq;
}

async function upsertStaff(conn, db, items, graph) {
  const toUpdate = [];
  const toInsert = [];
  for (const item of items) {
    for (const r of item.staff || []) {
      const kind = r[1];
      const existingId = graph.staffByLeadKind.get(`${item._leadId}:${kind}`);
      const audited = [...withFullAudit(r, item.audit), 1];
      if (existingId) {
        toUpdate.push([
          existingId, audited[2], audited[3], audited[4], audited[5],
          item.audit.updatedAt, item.audit.updatedByUserId, 1,
        ]);
      } else {
        toInsert.push(audited);
      }
    }
  }
  await bulkUpdateByPk(conn, db, 'lead_staff', 'id_lead_staff', [
    'id_user', 'staff_key', 'staff_display_name', 'assigned_at',
    'updated_at', 'updated_by_user_id', 'is_active',
  ], toUpdate);
  if (toInsert.length) {
    await bulkInsert(conn, db, 'lead_staff', [
      'id_lead', 'id_staff_kind', 'id_user', 'staff_key', 'staff_display_name', 'assigned_at',
      'created_at', 'updated_at', 'created_by_user_id', 'updated_by_user_id', 'is_active',
    ], toInsert);
  }
}

async function upsertNotes(conn, db, items, graph) {
  const toUpdate = [];
  const toInsert = [];
  for (const item of items) {
    for (const r of item.notes || []) {
      const type = r[1];
      const existingId = graph.noteByLeadType.get(`${item._leadId}:${type}`);
      if (existingId) {
        toUpdate.push([existingId, r[2], r[3], r[4], r[5]]);
      } else {
        toInsert.push(r);
      }
    }
  }
  await bulkUpdateByPk(conn, db, 'lead_note', 'id_note', [
    'body', 'posted_at', 'posted_by', 'posted_by_user_id',
  ], toUpdate);
  if (toInsert.length) {
    await bulkInsert(conn, db, 'lead_note', [
      'id_lead', 'note_type', 'body', 'posted_at', 'posted_by', 'posted_by_user_id',
    ], toInsert);
  }
}

async function upsertInsurance(conn, db, items, graph, partyIdByLeadSeq) {
  const toUpdate = [];
  const toInsert = [];
  for (const item of items) {
    for (const row of item.insurance || []) {
      if (row[2] === 'PASSENGER') {
        const partyId = partyIdByLeadSeq.get(`${row[0]}:${row[3]}`);
        if (partyId) row[1] = partyId;
      }
      const seq = row[3] == null ? '' : Number(row[3]);
      const existingId = graph.insByLeadRoleSeq.get(`${item._leadId}:${row[2]}:${seq}`);
      const audited = withFullAudit(row, item.audit);
      if (existingId) {
        toUpdate.push([
          existingId, audited[1], audited[4], audited[5],
          item.audit.updatedAt, item.audit.updatedByUserId,
        ]);
      } else {
        toInsert.push(audited);
      }
    }
  }
  await bulkUpdateByPk(conn, db, 'lead_insurance', 'id_lead_insurance', [
    'id_lead_party', 'carrier_raw', 'id_carrier', 'updated_at', 'updated_by_user_id',
  ], toUpdate);
  if (toInsert.length) {
    await bulkInsert(conn, db, 'lead_insurance', [
      'id_lead', 'id_lead_party', 'insurance_role', 'party_sequence', 'carrier_raw', 'id_carrier',
      'created_at', 'updated_at', 'created_by_user_id', 'updated_by_user_id',
    ], toInsert);
  }
}

async function upsertRejects(conn, db, items, graph) {
  const toUpdate = [];
  const toInsert = [];
  for (const item of items) {
    for (const r of item.rejects || []) {
      const existingId = graph.rejectByLeadField.get(`${item._leadId}:${r[1]}`);
      if (existingId) {
        toUpdate.push([existingId, r[2], r[3]]);
      } else {
        toInsert.push(r);
      }
    }
  }
  await bulkUpdateByPk(conn, db, 'import_reject', 'id_reject', [
    'raw_value', 'reject_reason',
  ], toUpdate);
  if (toInsert.length) {
    await bulkInsert(conn, db, 'import_reject', [
      'id_lead', 'field_name', 'raw_value', 'reject_reason',
    ], toInsert);
  }
}

module.exports = {
  loadExistingLeadGraph,
  upsertPrimaryPeople,
  upsertClientContacts,
  upsertPassengers,
  upsertStaff,
  upsertNotes,
  upsertInsurance,
  upsertRejects,
};
