const test = require("node:test");
const assert = require("node:assert/strict");

const { normalizeCarsBasePayload } = require("../lib/carsBaseCatalog");

test("normalizeCarsBasePayload maps API marks and models", () => {
  const payload = normalizeCarsBasePayload([
    {
      id: "TOYOTA",
      name: "Toyota",
      cyrillic_name: "Тойота",
      models: [
        {
          id: "TOYOTA_CAMRY",
          name: "Camry",
          cyrillic_name: "Камри",
          year_from: 2012,
          year_to: 2024
        }
      ]
    }
  ]);

  assert.equal(payload.length, 1);
  assert.equal(payload[0].autoru_id, "toyota");
  assert.equal(payload[0].name, "Toyota");
  assert.equal(payload[0].name_ru, "Тойота");
  assert.equal(payload[0].models[0].name, "Camry");
  assert.equal(payload[0].models[0].name_ru, "Камри");
  assert.equal(payload[0].models[0].year_from, 2012);
});
