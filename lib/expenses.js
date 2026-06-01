const { round2 } = require("./money");

const EXPENSE_CATEGORIES = ["materials", "salary", "purchase", "rent", "other"];
const EXPENSE_CATEGORY_LABELS = {
  materials: "Расходники",
  salary: "Зарплата",
  purchase: "Закупка",
  rent: "Аренда",
  other: "Прочее"
};

function normalizeCategory(value) {
  const v = String(value ?? "").trim().toLowerCase();
  return EXPENSE_CATEGORIES.includes(v) ? v : "other";
}

async function expensesTotalInPeriod(db, start_date, end_date) {
  const rows = await db.query(
    `SELECT COALESCE(SUM(amount), 0) AS total
     FROM expenses
     WHERE expense_date >= ? AND expense_date <= ?`,
    [start_date, end_date]
  );
  return round2(Number(rows[0]?.total) || 0);
}

module.exports = {
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_LABELS,
  normalizeCategory,
  expensesTotalInPeriod
};
