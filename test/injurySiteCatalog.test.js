require("./helpers/env");
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { parseInjuryField, splitInjuryTokens } = require("../src/migration/injurySiteCatalog");

describe("parseInjuryField", () => {
  it("un solo token de severity no es sitio", () => {
    assert.deepEqual(parseInjuryField("Mild"), {
      siteTokens: [],
      severityFromInjury: "Mild",
    });
    assert.deepEqual(parseInjuryField("Moderate"), {
      siteTokens: [],
      severityFromInjury: "Moderate",
    });
  });

  it("N/A de severity no genera sitio ni severity usable", () => {
    assert.deepEqual(parseInjuryField("N/A"), {
      siteTokens: [],
      severityFromInjury: null,
    });
  });

  it("sitios + severity mezclados: se quedan los sitios, se descarta el alias", () => {
    assert.deepEqual(parseInjuryField("Neck, Moderate, Back"), {
      siteTokens: ["Neck", "Back"],
      severityFromInjury: null,
    });
  });

  it("dedup de tokens y vacío", () => {
    assert.deepEqual(splitInjuryTokens("Neck, Neck, Back"), ["Neck", "Back"]);
    assert.deepEqual(parseInjuryField(""), { siteTokens: [], severityFromInjury: null });
    assert.deepEqual(parseInjuryField(null), { siteTokens: [], severityFromInjury: null });
  });
});
