const test = require("node:test");
const assert = require("node:assert/strict");

const { buildOrderGroups, parseDateRu, parsePrice } = require("../lib/uchetCsv");

test("parseDateRu handles DD.MM.YYYY", () => {
  assert.equal(parseDateRu("05.01.2026"), "2026-01-05");
  assert.equal(parseDateRu("17.03.26"), "2026-03-17");
});

test("parsePrice handles spaces and dashes", () => {
  assert.equal(parsePrice("13 500"), 13500);
  assert.equal(parsePrice("-----"), 0);
});

test("buildOrderGroups groups lines by date+car and keeps payment", () => {
  const groups = buildOrderGroups([
    {
      dateRaw: "05.01.2026",
      workType: "Мойка",
      car: "Мазда cx5",
      master: "Богдан",
      service: "Химчистка",
      price: 6000,
      payment: 12000,
      note: null
    },
    {
      dateRaw: "",
      workType: "Мойка",
      car: "",
      master: "Богдан",
      service: "Воск",
      price: 3000,
      payment: null,
      note: null
    },
    {
      dateRaw: "",
      workType: "Мойка",
      car: "",
      master: "Богдан",
      service: "Антидождь",
      price: 3000,
      payment: null,
      note: null
    }
  ]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].lines.length, 3);
  assert.equal(groups[0].payment, 12000);
  assert.equal(
    groups[0].lines.reduce((s, l) => s + l.price, 0),
    12000
  );
});
