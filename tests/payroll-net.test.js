const test = require("node:test");
const assert = require("node:assert/strict");

const { createTestApp } = require("./helpers/testApp");
const { freezeOrderEarned, computeEarnedForLine } = require("../lib/payroll");

async function seedOrder(ctx) {
  await ctx.db.query(`INSERT INTO clients(full_name, phone_raw, phone_normalized) VALUES ('C','1','79991110000')`);
  const clientId = (await ctx.db.query("SELECT id FROM clients LIMIT 1"))[0].id;
  await ctx.db.query(`INSERT INTO cars(client_id) VALUES (?)`, [clientId]);
  const carId = (await ctx.db.query("SELECT id FROM cars LIMIT 1"))[0].id;
  await ctx.db.query(
    `INSERT INTO orders(car_id, status, closed_at) VALUES (?, 'completed', datetime('now'))`,
    [carId]
  );
  return (await ctx.db.query("SELECT id FROM orders LIMIT 1"))[0].id;
}

test("net_percent subtracts work-line consumables before percentage", () => {
  const r = computeEarnedForLine({ total: 1000 }, { mode: "net_percent", value: 50 }, { allocatedMaterials: 400 });
  assert.equal(r.earned, 300); // (1000 - 400) * 50%
});

test("product tab cost does not reduce payroll", async (t) => {
  const ctx = await createTestApp();
  t.after(() => ctx.close());

  const masterId = ctx.users.master.id;
  const orderId = await seedOrder(ctx);

  await ctx.db.query(
    `INSERT INTO order_lines(order_id, line_type, name, quantity, unit_price, total, master_id, work_status)
     VALUES (?, 'work', 'Ремонт', 1, 2000, 2000, ?, 'done')`,
    [orderId, masterId]
  );
  await ctx.db.query(
    `INSERT INTO order_lines(order_id, line_type, name, quantity, unit_price, total, cost_price)
     VALUES (?, 'product', 'Деталь', 1, 1000, 1000, 600)`,
    [orderId]
  );

  await freezeOrderEarned(orderId);

  const line = (await ctx.db.query(
    "SELECT master_comp_mode, master_earned_amount FROM order_lines WHERE line_type='work' AND order_id=?",
    [orderId]
  ))[0];
  assert.equal(line.master_comp_mode, "net_percent");
  assert.equal(Number(line.master_earned_amount), 1000); // 2000 * 50%, product ignored
});

test("work line consumable reduces payroll base", async (t) => {
  const ctx = await createTestApp();
  t.after(() => ctx.close());

  const masterId = ctx.users.master.id;
  const orderId = await seedOrder(ctx);

  await ctx.db.query(
    `INSERT INTO order_lines(order_id, line_type, name, quantity, unit_price, total, master_id, work_status, cost_price)
     VALUES (?, 'work', 'Ремонт', 1, 2000, 2000, ?, 'done', 400)`,
    [orderId, masterId]
  );
  await ctx.db.query(
    `INSERT INTO order_lines(order_id, line_type, name, quantity, unit_price, total, cost_price)
     VALUES (?, 'product', 'Деталь', 1, 1000, 1000, 600)`,
    [orderId]
  );

  await freezeOrderEarned(orderId);

  const line = (await ctx.db.query(
    "SELECT master_earned_amount FROM order_lines WHERE line_type='work' AND order_id=?",
    [orderId]
  ))[0];
  assert.equal(Number(line.master_earned_amount), 800); // (2000 - 400) * 50%
});

test("order-linked materials expense does not reduce payroll", async (t) => {
  const ctx = await createTestApp();
  t.after(() => ctx.close());

  const masterId = ctx.users.master.id;
  const orderId = await seedOrder(ctx);

  await ctx.db.query(
    `INSERT INTO order_lines(order_id, line_type, name, quantity, unit_price, total, master_id, work_status)
     VALUES (?, 'work', 'Работа', 1, 1000, 1000, ?, 'done')`,
    [orderId, masterId]
  );
  await ctx.db.query(
    `INSERT INTO expenses(expense_date, category, amount, order_id) VALUES (date('now'), 'materials', 200, ?)`,
    [orderId]
  );

  await freezeOrderEarned(orderId);
  const line = (await ctx.db.query(
    "SELECT master_earned_amount FROM order_lines WHERE line_type='work' AND order_id=?",
    [orderId]
  ))[0];
  assert.equal(Number(line.master_earned_amount), 500); // 1000 * 50%
});
