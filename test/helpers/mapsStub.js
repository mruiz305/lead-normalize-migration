require("./env");
const { TYPE } = require("../../src/migration/contactChannelTypes");
const { KIND } = require("../../src/migration/addressKind");

const SEVERITY_IDS = { Mild: 1, Moderate: 2, High: 3, Major: 4 };
const SITE_IDS = { Neck: 10, Back: 11, Head: 12 };
const CARRIER_IDS = { GEICO: 21, Progressive: 22 };

function buildMaps(overrides = {}) {
  const userByEmail = new Map([
    ["rep@nofault.com", 501],
    ["creator@nofault.com", 502],
    ["dir@nofault.com", 601],
    ["region@nofault.com", 602],
    ["tpa-boss@nofault.com", 603],
    ["pod@nofault.com", 604],
    ["team@nofault.com", 605],
    ["duo@nofault.com", 606],
  ]);

  return {
    resolveAttorneyProfileId: (key) => (key === "Smith PA" ? 31 : null),
    txByName: new Map([["Miami Clinic", 41]]),
    leadStatusByName: new Map([["New", 1], ["Signed", 2]]),
    clinicalStatusByName: new Map([["Pending", 1]]),
    legalStatusByName: new Map([["Open", 1]]),
    stageByCode: new Map([["Owned", 7], ["New", 1]]),
    resolveCompanyOfficeId: (code) => {
      if (code === "MIA") return 81;
      if (code === "TPA") return 82;
      return null;
    },
    resolveAccidentLocationTypeId: (raw) =>
      raw === "Intersection" ? { id: 3, raw } : { id: null, raw },
    resolveAtFaultTypeId: (v) => {
      if (!v) return { id: null, raw: null };
      return v === "Other Driver" ? { id: 4, raw: v } : { id: null, raw: v };
    },
    resolveSeverityId: (v) => {
      if (v == null || String(v).trim() === "") return { id: null, raw: null };
      return { id: SEVERITY_IDS[v] ?? null, raw: v };
    },
    parseInjuryField: (raw) => {
      if (raw == null || String(raw).trim() === "") {
        return { siteTokens: [], severityFromInjury: null };
      }
      const text = String(raw).trim();
      if (SEVERITY_IDS[text] != null) {
        return { siteTokens: [], severityFromInjury: text };
      }
      const siteTokens = text.split(",").map((s) => s.trim()).filter(Boolean)
        .filter((t) => SEVERITY_IDS[t] == null);
      return { siteTokens, severityFromInjury: null };
    },
    resolveInjurySiteId: (token) => ({ raw: token, id: SITE_IDS[token] ?? null }),
    resolveCarrier: (val) => {
      const raw = val == null || String(val).trim() === "" ? null : String(val).trim();
      if (!raw) return { raw: null, id: null };
      return { raw, id: CARRIER_IDS[raw] ?? null };
    },
    SCOPE_PIP: "PIP",
    SCOPE_AT_FAULT: "AT_FAULT",
    userByEmail,
    channelTypeByCode: new Map([
      [TYPE.PHONE_MOBILE, 1],
      [TYPE.PHONE_INTAKE_RAW, 2],
      [TYPE.PHONE_INTAKE_FORMATTED, 3],
      [TYPE.EMAIL_PERSONAL, 4],
    ]),
    addressKindByCode: new Map([[KIND.RESIDENCE, 1]]),
    resolveStateId: (text) => {
      if (!text) return null;
      const key = String(text).trim().toUpperCase();
      if (key === "FL" || key === "FLORIDA") return 12;
      return null;
    },
    resolveLinkedUserId: (email, phone) => {
      if (email && String(email).toLowerCase() === "ana@example.com") return 900;
      if (phone === "3055551234") return 900;
      return null;
    },
    ...overrides,
  };
}

function rejectReasons(out) {
  return out.rejects.map((r) => r[3]);
}

function rejectFields(out) {
  return out.rejects.map((r) => r[1]);
}

module.exports = {
  buildMaps,
  rejectReasons,
  rejectFields,
  SEVERITY_IDS,
  SITE_IDS,
  CARRIER_IDS,
};
