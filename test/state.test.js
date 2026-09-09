require("./helpers/env");
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { resolveStateId } = require("../src/migration/state");

const maps = {
  stateByCode: new Map([["FL", 12], ["TX", 48]]),
  stateByName: new Map([["florida", 12], ["texas", 48]]),
};

describe("resolveStateId", () => {
  it("resuelve código corto y nombre", () => {
    assert.equal(resolveStateId(maps, "FL"), 12);
    assert.equal(resolveStateId(maps, "florida"), 12);
    assert.equal(resolveStateId(maps, "Texas"), 48);
  });

  it("vacío o desconocido → null", () => {
    assert.equal(resolveStateId(maps, null), null);
    assert.equal(resolveStateId(maps, "  "), null);
    assert.equal(resolveStateId(maps, "ZZ"), null);
  });
});
