const { getDB } = require("../config/database");
const { parseMoney } = require("../lib/money");
const { parseDateRange } = require("../lib/finance");
const {
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_LABELS,
  normalizeCategory
} = require("../lib/expenses");

const PAYMENT_METHODS = ["cash", "card", "transfer", "other"];

async function list(req, res) {
  const db = await getDB();
  const range = parseDateRange(req.query);
  const category = req.query.category ? normalizeCategory(req.query.category) : "";

  const where = ["expense_date >= ?", "expense_date <= ?"];
  const params = [range.start_date, range.end_date];
  if (category) {
    where.push("category = ?");
    params.push(category);
  }

  const rows = await db.query(
    `
    SELECT e.*, o.id AS order_ref
    FROM expenses e
    LEFT JOIN orders o ON o.id = e.order_id
    WHERE ${where.join(" AND ")}
    ORDER BY e.expense_date DESC, e.id DESC
    LIMIT 500
  `,
    params
  );

  const totals = await db.query(
    `
    SELECT category, COALESCE(SUM(amount), 0) AS total
    FROM expenses
    WHERE expense_date >= ? AND expense_date <= ?
    GROUP BY category
  `,
    [range.start_date, range.end_date]
  );
  const total = rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);

  res.render("expenses/index", {
    expenses: rows,
    totals,
    total,
    range,
    category,
    categories: EXPENSE_CATEGORIES,
    categoryLabels: EXPENSE_CATEGORY_LABELS,
    methods: PAYMENT_METHODS,
    user: req.session.user,
    category_nav: "expenses",
    canMutate: ["owner", "admin"].includes(req.session.user.role)
  });
}

async function create(req, res) {
  const db = await getDB();
  const amount = parseMoney(req.body.amount);
  const expense_date = String(req.body.expense_date ?? "").slice(0, 10) || new Date().toISOString().slice(0, 10);
  const category = normalizeCategory(req.body.category);
  const payment_method = PAYMENT_METHODS.includes(String(req.body.payment_method))
    ? String(req.body.payment_method)
    : "cash";
  const vendor = String(req.body.vendor ?? "").trim() || null;
  const note = String(req.body.note ?? "").trim() || null;
  const order_id = req.body.order_id ? Number(req.body.order_id) : null;

  if (amount <= 0) {
    return res.redirect("/expenses");
  }

  await db.query(
    `
    INSERT INTO expenses(expense_date, category, amount, payment_method, vendor, note, order_id, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `,
    [
      expense_date,
      category,
      amount,
      payment_method,
      vendor,
      note,
      Number.isFinite(order_id) && order_id > 0 ? order_id : null,
      req.session.user?.id || null
    ]
  );

  const back = req.body.order_id ? `/orders/${order_id}` : "/expenses";
  return res.redirect(back);
}

async function remove(req, res) {
  const db = await getDB();
  await db.query("DELETE FROM expenses WHERE id = ?", [Number(req.params.id)]);
  return res.redirect("/expenses");
}

module.exports = { list, create, remove };
