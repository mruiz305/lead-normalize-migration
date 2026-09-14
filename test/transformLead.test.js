require("./helpers/env");
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { transformLead } = require("../src/migration/pipeline");
const { buildMaps, rejectReasons, rejectFields } = require("./helpers/mapsStub");

function baseLead(extra = {}) {
  return {
    idLead: 1001,
    firstName: "Ana",
    lastName: "Perez",
    phone: "3055551234",
    email: "ana@example.com",
    created: "2024-01-15 10:00:00",
    leadStatus: "New",
    officeLabel: "MIA",
    submitter: "rep@nofault.com",
    ...extra,
  };
}

describe("transformLead happy path", () => {
  it("arma lead, client y canales phone/email", () => {
    const out = transformLead(baseLead(), buildMaps());
    assert.equal(out.leadId, 1001);
    assert.equal(out.lead[0], 1001); // glide_id: el PK local lo asigna AUTO_INCREMENT
    assert.equal(out.lead[3], 81);
    assert.equal(out.lead[4], 501);
    assert.equal(out.client[0], "Ana");
    assert.equal(out.client[1], "Perez");
    assert.equal(out.client[6], "2024-01-15 10:00:00");
    const values = out.channels.map((c) => c[1]);
    assert.ok(values.includes("3055551234"));
    assert.ok(values.includes("ana@example.com"));
    assert.ok(!rejectReasons(out).includes("date_miss"));
    assert.ok(!rejectReasons(out).includes("office_catalog_miss"));
    // officeLabel "MIA" se reusa como email de org_office → user_miss esperado
  });
});

describe("transformLead fechas y catálogos", () => {
  it("sin timestamps usa 1970-01-01 y reject date_miss", () => {
    const out = transformLead(
      baseLead({ created: null, dateCreated: null, updated: null }),
      buildMaps()
    );
    assert.ok(rejectReasons(out).includes("date_miss"));
    assert.equal(out.client[6].toISOString(), "1970-01-01T00:00:00.000Z");
  });

  it("officeLabel desconocido → office_catalog_miss y lead sigue", () => {
    const out = transformLead(baseLead({ officeLabel: "ZZZ" }), buildMaps());
    assert.ok(rejectReasons(out).includes("office_catalog_miss"));
    assert.ok(rejectFields(out).includes("officeLabel"));
    assert.equal(out.lead[0], 1001);
    assert.equal(out.lead[3], null);
  });

  it("submitter desconocido → user_miss, staff conserva el email", () => {
    const out = transformLead(baseLead({ submitter: "ghost@x.com" }), buildMaps());
    assert.ok(rejectReasons(out).includes("user_miss"));
    assert.ok(rejectFields(out).includes("submitter"));
    assert.equal(out.lead[4], null);
    assert.equal(out.staff.length, 1);
    assert.equal(out.staff[0][3], "ghost@x.com");
  });
});

describe("transformLead pasajeros", () => {
  it("slot vacío no genera party; slot 1 y 3 (DOB2) sí", () => {
    const out = transformLead(
      baseLead({
        psngr1FirstName: "Luis",
        psngr1LastName: "Gomez",
        psngr1Phone: "3055550001",
        psngr3LastName: "Ruiz",
      }),
      buildMaps()
    );
    assert.equal(out.passengers.length, 2);
    assert.equal(out.passengers[0].slotSeq, 1);
    assert.equal(out.passengers[0].client[0], "Luis");
    assert.equal(out.passengers[1].slotSeq, 3);
    assert.equal(out.passengers[1].client[1], "Ruiz");
    assert.equal(out.passengers[0].party[2], 2);
  });
});

describe("transformLead injuries e insurance", () => {
  it("sitios + severity embebida en injuries cuando no hay personalInjury", () => {
    const out = transformLead(
      baseLead({ injuries: "Moderate", personalInjury: null }),
      buildMaps()
    );
    assert.equal(out.personalSeverityRaw, "Moderate");
    assert.equal(out.accident[9], 2);
    assert.equal(out.injury, null);
  });

  it("sitios anatómicos generan injury + injurySiteRaws", () => {
    const out = transformLead(baseLead({ injuries: "Neck, Back" }), buildMaps());
    assert.ok(out.injury);
    assert.deepEqual(
      out.injurySiteRaws.map((s) => s.token),
      ["Neck", "Back"]
    );
    assert.equal(out.injurySiteRaws[0].id, 10);
  });

  it("PIP, at-fault y passenger van a insurance con scopes distintos", () => {
    const out = transformLead(
      baseLead({
        pipInsurance: "GEICO",
        atfaultInsurance: "Progressive",
        psngr1FirstName: "Luis",
        psngr1Insurance: "GEICO",
      }),
      buildMaps()
    );
    const roles = out.insurance.map((r) => r[2]);
    assert.deepEqual(roles, ["PIP", "AT_FAULT", "PASSENGER"]);
    assert.equal(out.insurance[0][4], "GEICO");
    assert.equal(out.insurance[1][4], "Progressive");
    assert.equal(out.insurance[2][3], 1);
  });
});

describe("transformLead org snapshot", () => {
  it("toma directorate→duo y oficina desde tblLeads, no desde un mapa de g_users", () => {
    const out = transformLead(
      baseLead({
        officeLabel: "TPA",
        office: "tpa-boss@nofault.com",
        officeName: "Tampa",
        directorate: "dir@nofault.com",
        directorateName: "Intake",
        region: "region@nofault.com",
        regionName: "Florida",
        pod: "pod@nofault.com",
        podName: "Pod A",
        team: "team@nofault.com",
        teamName: "Team 1",
        duo: "duo@nofault.com",
        duoName: "Duo X",
      }),
      buildMaps()
    );
    const s = out.orgSnapshot;
    assert.equal(s[1], "dir@nofault.com");
    assert.equal(s[2], "Intake");
    assert.equal(s[3], 601);
    assert.equal(s[4], "region@nofault.com");
    assert.equal(s[5], "Florida");
    assert.equal(s[6], 602);
    assert.equal(s[7], "TPA");
    assert.equal(s[8], 82);
    assert.equal(s[9], "Tampa");
    assert.equal(s[10], "tpa-boss@nofault.com");
    assert.equal(s[11], 603);
    assert.equal(s[12], "pod@nofault.com");
    assert.equal(s[14], 604);
    assert.equal(s[15], "team@nofault.com");
    assert.equal(s[17], 605);
    assert.equal(s[18], "duo@nofault.com");
    assert.equal(s[20], 606);
    assert.equal(out.lead[3], 82);
  });
});

describe("transformLead flags y notas", () => {
  it("sync flags solo si el valor no está vacío", () => {
    const out = transformLead(
      baseLead({
        corProccesed: "Y",
        affProccesed: "",
        attyProccesed: null,
        newLeadEmailProccesed: "  ",
        lockDownEmailProccesed: "1",
      }),
      buildMaps()
    );
    assert.deepEqual(
      out.syncFlags.map((f) => f[1]),
      ["COR", "LOCKDOWN_EMAIL"]
    );
  });

  it("notas vacías no se insertan; intake/accident/hospital sí", () => {
    const out = transformLead(
      baseLead({
        leadNotes: "llamó el lunes",
        accidentNotes: "  ",
        hospitalNotes: "ER Jackson",
      }),
      buildMaps()
    );
    assert.deepEqual(
      out.notes.map((n) => n[1]),
      ["intake", "hospital"]
    );
    assert.equal(out.notes[0][2], "llamó el lunes");
  });
});
