const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const { createTestApp } = require("./helpers/testApp");
const {
  normalizeArticle,
  validateArticleFormat,
  suggestNextArticle
} = require("../lib/catalogArticle");

test("normalizeArticle uppercases and trims", () => {
  assert.equal(normalizeArticle("  w-00001  "), "W-00001");
});

test("validateArticleFormat rejects empty and invalid", () => {
  assert.ok(validateArticleFormat(""));
  assert.ok(validateArticleFormat("x"));
  assert.equal(validateArticleFormat("W-00001"), null);
});

test("suggestNextArticle returns W- prefix for work", async (t) => {
  const ctx = await createTestApp();
  t.after(() => ctx.close());

  await ctx.db.query(
    `INSERT INTO catalog_items(type, category, name, article, default_price, is_active) VALUES ('work', 'Мойка', 'Тест', 'W-00099', 100, 1)`
  );
  const article = await suggestNextArticle(ctx.db, "work");
  assert.match(article, /^W-\d{5}$/);
  assert.notEqual(article, "W-00099");
});

test("check-article API detects duplicate", async (t) => {
  const ctx = await createTestApp();
  t.after(() => ctx.close());

  await ctx.db.query(
    `INSERT INTO catalog_items(type, category, name, article, default_price, is_active) VALUES ('work', 'Мойка', 'Уникальная работа', 'W-77777', 500, 1)`
  );

  const agent = request.agent(ctx.app);
  await ctx.loginAs(agent, "admin", "admin");

  const free = await agent.get("/api/catalog/check-article?article=W-88888");
  assert.equal(free.status, 200);
  assert.equal(free.body.available, true);

  const dup = await agent.get("/api/catalog/check-article?article=w-77777");
  assert.equal(dup.status, 200);
  assert.equal(dup.body.available, false);
  assert.equal(dup.body.existing.name, "Уникальная работа");
});

test("suggest-article API returns next free article", async (t) => {
  const ctx = await createTestApp();
  t.after(() => ctx.close());

  const agent = request.agent(ctx.app);
  await ctx.loginAs(agent, "admin", "admin");

  const res = await agent.get("/api/catalog/suggest-article?type=product");
  assert.equal(res.status, 200);
  assert.match(res.body.article, /^P-\d{5}$/);
});

test("catalog create rejects duplicate article", async (t) => {
  const ctx = await createTestApp();
  t.after(() => ctx.close());

  await ctx.db.query(
    `INSERT INTO catalog_items(type, category, name, article, default_price, is_active) VALUES ('work', 'Мойка', 'Первая', 'W-DUP01', 100, 1)`
  );

  const agent = request.agent(ctx.app);
  await ctx.loginAs(agent, "admin", "admin");

  const res = await agent.post("/catalog").type("form").send({
    type: "work",
    category: "Мойка",
    name: "Вторая",
    article: "w-dup01",
    default_price: "200",
    is_active: "1"
  });
  assert.equal(res.status, 400);
  assert.match(res.text, /Артикул уже занят/);
});
