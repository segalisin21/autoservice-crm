const { test } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const { createTestApp } = require("./helpers/testApp");

async function seedOrderWithTotal(ctx, total) {
  const clientId = await ctx.db.insertReturning(
    `INSERT INTO clients(full_name, full_name_lc, phone_raw, phone_normalized) VALUES ('Test', 'test', '79001112233', '79001112233')`
  );
  const carId = await ctx.db.insertReturning(
    `INSERT INTO cars(client_id, make, model) VALUES (?, 'VW', 'Polo')`,
    [clientId]
  );
  const orderId = await ctx.db.insertReturning(
    `INSERT INTO orders(car_id, status, total_price, subtotal_works, scheduled_date) VALUES (?, 'scheduled', ?, ?, '2026-06-01')`,
    [carId, total, total]
  );
  return orderId;
}

test("payment rejects overpay within transaction", async (t) => {
  const ctx = await createTestApp();
  t.after(() => ctx.close());

  const orderId = await seedOrderWithTotal(ctx, 1000);
  const agent = request.agent(ctx.app);
  await ctx.loginAs(agent, "admin", "admin");

  await agent.post(`/orders/${orderId}/payments`).type("form").send({ amount: "600", method: "cash", kind: "payment" });
  await agent.post(`/orders/${orderId}/payments`).type("form").send({ amount: "600", method: "cash", kind: "payment" });

  const payments = await ctx.db.query("SELECT amount FROM payments WHERE order_id = ?", [orderId]);
  const sum = payments.reduce((acc, p) => acc + Number(p.amount), 0);
  assert.ok(sum <= 1000.005, `paid total ${sum} exceeds order total`);
});

test("order create rolls back client when order insert would fail", async (t) => {
  const ctx = await createTestApp();
  t.after(() => ctx.close());

  const beforeClients = await ctx.db.query("SELECT COUNT(*) AS c FROM clients");
  const before = Number(beforeClients[0].c);

  const agent = request.agent(ctx.app);
  await ctx.loginAs(agent, "admin", "admin");

  const res = await agent.post("/orders").type("form").send({
    new_plate: "A123BC21",
    new_make: "Toyota",
    new_model: "Camry",
    new_owner_name: "Иван",
    new_owner_phone: "+7 900 111-22-33",
    scheduled_date: "",
    start_time: "10:00",
    assigned_user_id: ctx.users.master.id
  });
  assert.equal(res.status, 400);

  const afterClients = await ctx.db.query("SELECT COUNT(*) AS c FROM clients");
  assert.equal(Number(afterClients[0].c), before);
});
