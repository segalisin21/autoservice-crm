const test = require("node:test");
const assert = require("node:assert/strict");

const { createTestApp } = require("./helpers/testApp");
const { freezeOrderEarned } = require("../lib/payroll");
const { loadOrderEconomics } = require("../lib/orderEconomics");

async function seedOrder(ctx) {
  await ctx.db.query(`INSERT INTO clients(full_name, phone_raw, phone_normalized) VALUES ('C','1','79991110000')`);
  const clientId = (await ctx.db.query("SELECT id FROM clients LIMIT 1"))[0].id;
  await ctx.db.query(`INSERT INTO cars(client_id) VALUES (?)`, [clientId]);
  const carId = (await ctx.db.query("SELECT id FROM cars LIMIT 1"))[0].id;
  await ctx.db.query(
    `INSERT INTO orders(car_id, status, closed_at, total_price) VALUES (?, 'completed', datetime('now'), 2000)`,
    [carId]
  );
  return (await ctx.db.query("SELECT id FROM orders LIMIT 1"))[0].id;
}

test("work line consumable from catalog reduces payroll and profit", async (t) => {
  const ctx = await createTestApp();
  t.after(() => ctx.close());

  const masterId = ctx.users.master.id;
  const orderId = await seedOrder(ctx);

  await ctx.db.query(
    `INSERT INTO catalog_items(type, category, name, article, default_price, default_material_cost, unit, is_active)
     VALUES ('work', 'Мойка', 'Комплекс', 'W-00001', 2000, 400, 'усл.', 1)`
  );
  const catalogId = (await ctx.db.query("SELECT id FROM catalog_items LIMIT 1"))[0].id;

  await ctx.db.query(
    `INSERT INTO order_lines(
      order_id, line_type, catalog_item_id, name, quantity, unit_price, total,
      master_id, work_status, cost_price
    ) VALUES (?, 'work', ?, 'Комплекс', 1, 2000, 2000, ?, 'done', 400)`,
    [orderId, catalogId, masterId]
  );

  await freezeOrderEarned(orderId);

  const line = (
    await ctx.db.query(
      "SELECT master_earned_amount FROM order_lines WHERE order_id = ? AND line_type = 'work'",
      [orderId]
    )
  )[0];
  assert.equal(Number(line.master_earned_amount), 800); // (2000 - 400) * 50%

  const economics = await loadOrderEconomics(ctx.db, orderId);
  assert.equal(economics.materials, 400);
  assert.equal(economics.payroll, 800);
  assert.equal(economics.profit, 800); // 2000 - 400 - 800
});
