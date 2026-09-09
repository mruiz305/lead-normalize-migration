const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  normalizePhoneForMatch,
  buildUserLookup,
  createLinkedUserResolver,
} = require("../src/migration/clientLink");

describe("normalizePhoneForMatch", () => {
  it("deja los últimos 10 dígitos", () => {
    assert.equal(normalizePhoneForMatch("+1 (305) 555-1234"), "3055551234");
    assert.equal(normalizePhoneForMatch("3055551234"), "3055551234");
  });

  it("rechaza teléfonos cortos", () => {
    assert.equal(normalizePhoneForMatch("5551234"), null);
    assert.equal(normalizePhoneForMatch(null), null);
  });
});

describe("createLinkedUserResolver", () => {
  const { userByEmail, userByPhone } = buildUserLookup([
    { id_user: 1, email: "ana@example.com", phone: "305-555-1234" },
    { id_user: 2, email: "otro@x.com", phone: "7865559999" },
  ]);
  const resolve = createLinkedUserResolver(userByEmail, userByPhone);

  it("prioriza email sobre teléfono", () => {
    assert.equal(resolve("ana@example.com", "7865559999"), 1);
  });

  it("cae a teléfono si el email no matchea", () => {
    assert.equal(resolve("nadie@x.com", "+1 786 555 9999"), 2);
  });

  it("sin match → null", () => {
    assert.equal(resolve("nadie@x.com", "1111111111"), null);
  });
});
