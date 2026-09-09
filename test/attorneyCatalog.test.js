require("./helpers/env");
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  normalizeAttorneyLookup,
  parseStatesText,
  resolvePrimaryStateId,
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
