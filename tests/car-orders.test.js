const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const { createTestApp } = require("./helpers/testApp");

test("car show page lists orders newest first with work lines", async (t) => {
  const ctx = await createTestApp();
  t.after(() => ctx.close());

  await ctx.db.query(
    `INSERT INTO clients(full_name, phone_raw, phone_normalized) VALUES ('Клиент', '79990001122', '79990001122')`
  );
  const clientId = (await ctx.db.query("SELECT id FROM clients LIMIT 1"))[0].id;
  await ctx.db.query(`INSERT INTO cars(client_id, make, model) VALUES (?, 'BMW', 'X5')`, [clientId]);
  const carId = (await ctx.db.query("SELECT id FROM cars LIMIT 1"))[0].id;

  await ctx.db.query(
    `INSERT INTO orders(car_id, status, opened_at, total_price) VALUES (?, 'completed', '2026-01-10', 1500)`,
    [carId]
  );
  const olderOrderId = (await ctx.db.query("SELECT id FROM orders ORDER BY id ASC LIMIT 1"))[0].id;
  await ctx.db.query(
    `INSERT INTO order_lines(order_id, line_type, name, quantity, unit_price, total) VALUES (?, 'work', 'Старый ремонт', 1, 1500, 1500)`,
    [olderOrderId]
  );

  await ctx.db.query(
    `INSERT INTO orders(car_id, status, opened_at, total_price) VALUES (?, 'in_progress', '2026-06-15', 3000)`,
    [carId]
  );
  const newerOrderId = (await ctx.db.query("SELECT id FROM orders ORDER BY id DESC LIMIT 1"))[0].id;
  await ctx.db.query(
    `INSERT INTO order_lines(order_id, line_type, name, quantity, unit_price, total) VALUES (?, 'work', 'Свежая диагностика', 1, 3000, 3000)`,
    [newerOrderId]
  );

  const agent = request.agent(ctx.app);
  await ctx.loginAs(agent, "admin", "admin");

  const res = await agent.get(`/cars/${carId}`);
  assert.equal(res.status, 200);
  assert.ok(res.text.includes("Заказ-наряды"));
  assert.ok(res.text.includes(`#${newerOrderId}`));
  assert.ok(res.text.includes(`#${olderOrderId}`));
  assert.ok(res.text.includes("Свежая диагностика"));
  assert.ok(res.text.includes("Старый ремонт"));
  assert.ok(res.text.includes("2026-06-15"));
  assert.ok(res.text.includes("2026-01-10"));

  const newerPos = res.text.indexOf(`/orders/${newerOrderId}`);
  const olderPos = res.text.indexOf(`/orders/${olderOrderId}`);
  assert.ok(newerPos >= 0 && olderPos >= 0);
  assert.ok(newerPos < olderPos, "newer order should appear before older order");
});

test("car show page shows empty state when no orders", async (t) => {
  const ctx = await createTestApp();
  t.after(() => ctx.close());

  await ctx.db.query(
    `INSERT INTO clients(full_name, phone_raw, phone_normalized) VALUES ('Без заказов', '79990003344', '79990003344')`
  );
  const clientId = (await ctx.db.query("SELECT id FROM clients LIMIT 1"))[0].id;
  await ctx.db.query(`INSERT INTO cars(client_id, make, model) VALUES (?, 'Lada', 'Vesta')`, [clientId]);
  const carId = (await ctx.db.query("SELECT id FROM cars LIMIT 1"))[0].id;

  const agent = request.agent(ctx.app);
  await ctx.loginAs(agent, "admin", "admin");

  const res = await agent.get(`/cars/${carId}`);
  assert.equal(res.status, 200);
  assert.ok(res.text.includes("Заказов для этого авто пока нет."));
});
