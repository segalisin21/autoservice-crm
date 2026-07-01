const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const { createTestApp } = require("./helpers/testApp");
const { minimalOrderPayload } = require("./helpers/orderCreate");

test("GET /catalog/products/new renders product form", async (t) => {
  const ctx = await createTestApp();
  t.after(() => ctx.close());

  const agent = request.agent(ctx.app);
  await ctx.loginAs(agent, "admin", "admin");

  const res = await agent.get("/catalog/products/new");
  assert.equal(res.status, 200);
  assert.match(res.text, /Новый товар/);
  assert.match(res.text, /Цена продажи/);
  assert.match(res.text, /Закуп/);
  assert.match(res.text, /name="default_price"/);
  assert.match(res.text, /name="default_material_cost"/);
});

test("POST /catalog/products creates product with sale and purchase prices", async (t) => {
  const ctx = await createTestApp();
  t.after(() => ctx.close());

  const agent = request.agent(ctx.app);
  await ctx.loginAs(agent, "admin", "admin");

  const res = await agent.post("/catalog/products").type("form").send({
    name: "Масляный фильтр",
    article: "P-10001",
    default_price: "1500",
    default_material_cost: "900"
  });
  assert.equal(res.status, 302);
  assert.match(res.headers.location, /\/catalog\?type=product/);

  const row = (
    await ctx.db.query("SELECT * FROM catalog_items WHERE article = ?", ["P-10001"])
  )[0];
  assert.equal(row.type, "product");
  assert.equal(row.category, "Продажа");
  assert.equal(row.unit, "шт");
  assert.equal(Number(row.default_price), 1500);
  assert.equal(Number(row.default_material_cost), 900);
});

test("GET /catalog/products/:id/edit only for products", async (t) => {
  const ctx = await createTestApp();
  t.after(() => ctx.close());

  await ctx.db.query(
    `INSERT INTO catalog_items(type, category, name, article, default_price, is_active)
     VALUES ('product', 'Продажа', 'Товар', 'P-20001', 100, 1)`
  );
  await ctx.db.query(
    `INSERT INTO catalog_items(type, category, name, article, default_price, is_active)
     VALUES ('work', 'Мойка', 'Работа', 'W-20001', 200, 1)`
  );
  const productId = (await ctx.db.query("SELECT id FROM catalog_items WHERE type = 'product'"))[0].id;
  const workId = (await ctx.db.query("SELECT id FROM catalog_items WHERE type = 'work'"))[0].id;

  const agent = request.agent(ctx.app);
  await ctx.loginAs(agent, "admin", "admin");

  const productRes = await agent.get(`/catalog/products/${productId}/edit`);
  assert.equal(productRes.status, 200);
  assert.match(productRes.text, /Карточка товара/);

  const workRes = await agent.get(`/catalog/products/${workId}/edit`);
  assert.equal(workRes.status, 404);
});

test("work edit redirects product items to product form", async (t) => {
  const ctx = await createTestApp();
  t.after(() => ctx.close());

  await ctx.db.query(
    `INSERT INTO catalog_items(type, category, name, article, default_price, is_active)
     VALUES ('product', 'Продажа', 'Деталь', 'P-30001', 500, 1)`
  );
  const productId = (await ctx.db.query("SELECT id FROM catalog_items WHERE type = 'product'"))[0].id;

  const agent = request.agent(ctx.app);
  await ctx.loginAs(agent, "admin", "admin");

  const res = await agent.get(`/catalog/${productId}/edit`);
  assert.equal(res.status, 302);
  assert.equal(res.headers.location, `/catalog/products/${productId}/edit`);
});

test("adding product line uses catalog sale and purchase prices", async (t) => {
  const ctx = await createTestApp();
  t.after(() => ctx.close());

  await ctx.db.query(
    `INSERT INTO catalog_items(type, category, name, article, default_price, default_material_cost, is_active)
     VALUES ('product', 'Продажа', 'Свеча', 'P-40001', 800, 350, 1)`
  );
  const catId = (await ctx.db.query("SELECT id FROM catalog_items WHERE article = 'P-40001'"))[0].id;

  await ctx.db.query(
    `INSERT INTO clients(full_name, phone_raw, phone_normalized) VALUES ('Test', '+7', '79990000002')`
  );
  const clientId = (await ctx.db.query("SELECT id FROM clients LIMIT 1"))[0].id;
  await ctx.db.query(`INSERT INTO cars(client_id, make, model) VALUES (?, 'VW', 'Polo')`, [clientId]);
  const carId = (await ctx.db.query("SELECT id FROM cars LIMIT 1"))[0].id;

  const agent = request.agent(ctx.app);
  await ctx.loginAs(agent, "admin", "admin");

  const createOrder = await agent.post("/orders").type("form").send(minimalOrderPayload(ctx, { car_id: String(carId), notes: "" }));
  assert.equal(createOrder.status, 302);
  const orderId = (await ctx.db.query("SELECT id FROM orders ORDER BY id DESC LIMIT 1"))[0].id;

  await agent.post(`/orders/${orderId}/lines`).type("form").send({
    line_type: "product",
    catalog_item_id: String(catId),
    quantity: "2",
    unit_price: "",
    cost_price: ""
  });

  const line = (
    await ctx.db.query("SELECT unit_price, cost_price, total FROM order_lines WHERE order_id = ?", [orderId])
  )[0];
  assert.equal(Number(line.unit_price), 800);
  assert.equal(Number(line.cost_price), 350);
  assert.equal(Number(line.total), 1600);
});
