const test = require("node:test");
const assert = require("node:assert/strict");

const { createTestApp } = require("./helpers/testApp");
const { hashPassword } = require("../lib/password");
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

test("fixed amount splits by master share on work line", () => {
  const full = computeEarnedForLine({ total: 5000 }, { mode: "fixed", value: 1000 });
  assert.equal(full.earned, 1000);
  const half = computeEarnedForLine({ total: 5000 }, { mode: "fixed", value: 1000 }, { share: 0.5 });
  assert.equal(half.earned, 500);
});

test("fixed override splits equally between two masters on one work line", async (t) => {
  const ctx = await createTestApp();
  t.after(() => ctx.close());

  const master1Id = ctx.users.master.id;
  await ctx.db.query(
    `INSERT INTO users(username, password_hash, name, role, is_active, show_in_schedule) VALUES ('m2', ?, 'Master Two', 'master', 1, 1)`,
    [hashPassword("m2")]
  );
  const master2Id = (await ctx.db.query("SELECT id FROM users WHERE username = 'm2'"))[0].id;

  await ctx.db.query(`INSERT INTO catalog_items(type, category, name, default_price) VALUES ('work', 'T', 'Oil', 1000)`);
  const catalogId = (await ctx.db.query("SELECT id FROM catalog_items LIMIT 1"))[0].id;

  for (const uid of [master1Id, master2Id]) {
    await ctx.db.query(
      `INSERT INTO master_comp_overrides(user_id, catalog_item_id, mode, value) VALUES (?, ?, 'fixed', 1000)`,
      [uid, catalogId]
    );
  }

  const orderId = await seedOrder(ctx);
  await ctx.db.query(
    `INSERT INTO order_lines(order_id, line_type, catalog_item_id, name, quantity, unit_price, total, master_id, work_status)
     VALUES (?, 'work', ?, 'Oil', 1, 1000, 1000, ?, 'done')`,
    [orderId, catalogId, master1Id]
  );
  const lineId = (await ctx.db.query("SELECT id FROM order_lines WHERE order_id = ?", [orderId]))[0].id;
  await ctx.db.query(`INSERT INTO order_line_payroll(order_line_id, user_id, share_percent) VALUES (?, ?, 50)`, [
    lineId,
    master1Id
  ]);
  await ctx.db.query(`INSERT INTO order_line_payroll(order_line_id, user_id, share_percent) VALUES (?, ?, 50)`, [
    lineId,
    master2Id
  ]);

  await freezeOrderEarned(orderId);

  const payroll = await ctx.db.query(
    "SELECT user_id, earned_amount FROM order_line_payroll WHERE order_line_id = ? ORDER BY user_id",
    [lineId]
  );
  assert.equal(payroll.length, 2);
  for (const row of payroll) {
    assert.equal(Number(row.earned_amount), 500);
  }
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
