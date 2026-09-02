const test = require("node:test");
const assert = require("node:assert/strict");

const { createTestApp } = require("./helpers/testApp");
const { loadMarketComparison, resolvePosition, resolveDeltaPct } = require("../lib/marketBenchmark");

const WASH_COMPLEX_BAND = { typicalLow: 1100, typicalHigh: 2200 };

function findRow(rows, name) {
  return rows.find((r) => r.name === name);
}

test("resolvePosition and resolveDeltaPct classify against the typical band", () => {
  assert.equal(resolvePosition(900, WASH_COMPLEX_BAND), "below");
  assert.equal(resolvePosition(1500, WASH_COMPLEX_BAND), "in");
  assert.equal(resolvePosition(3000, WASH_COMPLEX_BAND), "above");
  assert.equal(resolvePosition(0, WASH_COMPLEX_BAND), "unknown");
  assert.equal(resolvePosition(null, WASH_COMPLEX_BAND), "unknown");

  // mid of 1100..2200 is 1650
  assert.equal(resolveDeltaPct(1650, WASH_COMPLEX_BAND), 0);
  assert.equal(resolveDeltaPct(3300, WASH_COMPLEX_BAND), 100);
  assert.equal(resolveDeltaPct(null, WASH_COMPLEX_BAND), null);
});

test("catalog price is matched by article and marked as above market", async (t) => {
  const ctx = await createTestApp();
  t.after(() => ctx.close());

  await ctx.db.query(
    `INSERT INTO catalog_items(type, category, name, article, default_price, price_tier_3, unit, is_active)
     VALUES ('work', 'Мойка', 'Комплекс Базовый', 'W-00035', 3000, 3600, 'усл.', 1)`
  );

  const data = await loadMarketComparison(ctx.db, { service: "wash", geography: "local" });
  const row = findRow(data.rows, "Комплексная мойка (кузов + салон)");

  assert.ok(row, "row must exist");
  assert.equal(row.inCatalog, true);
  assert.equal(row.priceSource, "catalog");
  assert.equal(row.ourPrice, 3000);
  assert.equal(row.ourPriceMax, 3600);
  assert.equal(row.position, "above");
  assert.ok(row.deltaPct > 0);
});

test("catalog price below the band is flagged as a price reserve", async (t) => {
  const ctx = await createTestApp();
  t.after(() => ctx.close());

  await ctx.db.query(
    `INSERT INTO catalog_items(type, category, name, article, default_price, unit, is_active)
     VALUES ('work', 'Электрика', 'Диагностика электрики', 'W-00007', 500, 'усл.', 1)`
  );

  const data = await loadMarketComparison(ctx.db, { service: "electrics", geography: "local" });
  const row = findRow(data.rows, "Компьютерная диагностика");

  assert.ok(row);
  assert.equal(row.ourPrice, 500);
  assert.equal(row.position, "below");
  assert.ok(row.deltaPct < 0);
  assert.ok(data.kpi.below >= 1);
});

test("services sold only in orders get a fact price and appear in gaps", async (t) => {
  const ctx = await createTestApp();
  t.after(() => ctx.close());

  await ctx.db.query(
    `INSERT INTO clients(full_name, phone_raw, phone_normalized) VALUES ('Noise', '1', '79990000777')`
  );
  const clientId = (await ctx.db.query("SELECT id FROM clients ORDER BY id DESC LIMIT 1"))[0].id;
  await ctx.db.query(`INSERT INTO cars(client_id) VALUES (?)`, [clientId]);
  const carId = (await ctx.db.query("SELECT id FROM cars ORDER BY id DESC LIMIT 1"))[0].id;
  await ctx.db.query(`INSERT INTO orders(car_id, status) VALUES (?, 'completed')`, [carId]);
  const orderId = (await ctx.db.query("SELECT id FROM orders ORDER BY id DESC LIMIT 1"))[0].id;

  await ctx.db.query(
    `INSERT INTO order_lines(order_id, line_type, name, name_lc, quantity, unit_price, total)
     VALUES (?, 'work', 'Шумоизоляция двери вместе с разбором', 'шумоизоляция двери вместе с разбором', 4, 2500, 10000)`,
    [orderId]
  );

  const data = await loadMarketComparison(ctx.db, { service: "noise", geography: "local" });
  const row = findRow(data.rows, "Шумоизоляция двери");

  assert.ok(row);
  assert.equal(row.inCatalog, false);
  assert.equal(row.priceSource, "orders");
  assert.equal(row.fact.count, 1);
  assert.equal(row.fact.avg, 2500);
  assert.equal(row.effectivePrice, 2500);
  assert.equal(row.position, "in");

  assert.ok(data.gaps.some((g) => g.name === "Шумоизоляция двери"));
  assert.ok(data.kpi.notInCatalog >= 1);
});

test("rows without catalog or order history report no price", async (t) => {
  const ctx = await createTestApp();
  t.after(() => ctx.close());

  const data = await loadMarketComparison(ctx.db, { service: "protect", geography: "local" });
  const row = findRow(data.rows, "Керамическое покрытие (1 слой)");

  assert.ok(row);
  assert.equal(row.inCatalog, false);
  assert.equal(row.priceSource, "none");
  assert.equal(row.effectivePrice, null);
  assert.equal(row.position, "unknown");
  assert.ok(data.missing.some((m) => m.name === "Керамическое покрытие (1 слой)"));
});

test("geography filter is applied to comparison rows", async (t) => {
  const ctx = await createTestApp();
  t.after(() => ctx.close());

  const data = await loadMarketComparison(ctx.db, { service: "all", geography: "major" });
  assert.ok(data.rows.length > 0);
  assert.ok(data.rows.every((row) => row.geography === "major"));
});

test("inactive catalog item is still matched when no active twin exists", async (t) => {
  const ctx = await createTestApp();
  t.after(() => ctx.close());

  await ctx.db.query(
    `INSERT INTO catalog_items(type, category, name, article, default_price, unit, is_active)
     VALUES ('work', 'Мойка', 'Комплекс Базовый +', 'W-00036', 3000, 'усл.', 0)`
  );

  const data = await loadMarketComparison(ctx.db, { service: "wash", geography: "local" });
  const row = findRow(data.rows, "Комплексная мойка (кузов + салон)");

  assert.ok(row);
  assert.equal(row.inCatalog, true);
  assert.equal(row.ourPrice, 3000);
  assert.equal(row.matchedItems[0].isActive, false);
});

test("chart shows at most 12 services ranked by deviation", async (t) => {
  const ctx = await createTestApp();
  t.after(() => ctx.close());

  const data = await loadMarketComparison(ctx.db, { service: "all", geography: "all" });
  assert.ok(data.chart.total >= data.chart.shown);
  assert.ok(data.chart.shown <= 12);
  assert.equal(data.chart.labels.length, data.chart.shown);
  if (data.chart.total > 12) {
    assert.equal(data.chart.truncated, true);
  }
});
