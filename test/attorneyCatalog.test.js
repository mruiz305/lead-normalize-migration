require("./helpers/env");
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  normalizeAttorneyLookup,
  parseStatesText,
  resolvePrimaryStateId,
  changedAttorneyIds,
} = require("../src/migration/attorneyCatalog");

describe("normalizeAttorneyLookup", () => {
  it("quita sufijo operativo MTD del dashboard", () => {
    assert.equal(
      normalizeAttorneyLookup("Smith PA G:0/37 MTD (Satisfied)"),
      "Smith PA"
    );
  });

  it("quita sufijo NS", () => {
    assert.equal(normalizeAttorneyLookup("Jones LLC NS"), "Jones LLC");
  });
});

describe("parseStatesText / resolvePrimaryStateId", () => {
  const stateByName = new Map([
    ["florida", 12],
    ["texas", 48],
  ]);
  const stateByCode = new Map([
    ["FL", 12],
    ["TX", 48],
  ]);

  it("parte lista de estados", () => {
    assert.deepEqual(parseStatesText("Florida, Texas"), ["Florida", "Texas"]);
  });

  it("usa código entre paréntesis del display name", () => {
    assert.equal(
      resolvePrimaryStateId("Smith PA (FL)", "", { stateByName, stateByCode }),
      12
    );
  });

  it("con varios estados en texto prefiere Florida", () => {
    assert.equal(
      resolvePrimaryStateId("Smith PA", "Texas, Florida", { stateByName, stateByCode }),
      12
    );
  });
});

describe("changedAttorneyIds", () => {
  it("detecta cambio de nombre, firma o grupo y ignora un abogado nuevo", () => {
    const previous = new Map([
      [1, { display_name: "Smith PA", firm_name: "Smith", contract_group: "A" }],
      [2, { display_name: "Jones LLC", firm_name: "Jones", contract_group: "B" }],
    ]);
    const next = [
      [1, "Smith Law", "Smith", "A"],
      [2, "Jones LLC", "Jones", "B"],
      [3, "Nuevo", "Nuevo", "C"],
    ];
    assert.deepEqual(changedAttorneyIds(previous, next), [1]);
  });
});

describe("resolvePrimaryStateId con paréntesis en el medio del nombre", () => {
  const stateByName = new Map([
    ["connecticut", 7], ["florida", 9], ["georgia", 10], ["maryland", 20],
    ["new york", 32], ["north carolina", 33], ["washington", 47],
  ]);
  const stateByCode = new Map([["FL", 9], ["MD", 20], ["NY", 32]]);
  const maps = { stateByName, stateByCode };

  it("el estado entre paréntesis gana a una calle con nombre de estado", () => {
    assert.equal(resolvePrimaryStateId("MHC HealthCare Clinic (Maryland) - Silver Spring Georgia Ave Suite 350", "Maryland", maps), 20);
    assert.equal(resolvePrimaryStateId("MHC HealthCare Clinic (Washington, D.C.) - Washington Connecticut Ave NW", "Washington", maps), 47);
  });

  it("acepta código, nombre de dos palabras y nombre con sufijo", () => {
    assert.equal(resolvePrimaryStateId("Robert Rubenstein (FL)", null, maps), 9);
    assert.equal(resolvePrimaryStateId("MHC HealthCare Clinic (North Carolina) - Cary", null, maps), 33);
    assert.equal(resolvePrimaryStateId("Big Ben FL NS (Florida Non Standard)", null, maps), 9);
    assert.equal(resolvePrimaryStateId("Hess Will Assign (New York) NS", null, maps), 32);
  });

  it("un paréntesis que no es estado no corta la búsqueda", () => {
    assert.equal(resolvePrimaryStateId("Ovadia Law (RO)", "Florida", maps), 9);
  });
});
