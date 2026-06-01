const { getDB } = require("../config/database");
const { round2 } = require("./money");

function computeDiscountAmount(order, subtotalWorks, subtotalProducts) {
  const type = order.discount_type || "none";
  const value = Number(order.discount_value) || 0;
  const scope = order.discount_scope || "order_total";

  let discountBase = subtotalWorks + subtotalProducts;
  if (scope === "works_only") discountBase = subtotalWorks;
  if (scope === "products_only") discountBase = subtotalProducts;

  if (type === "none" || discountBase <= 0) return 0;
  if (type === "amount") return round2(Math.min(value, discountBase));
  if (type === "percent") {
    const pct = Math.min(100, Math.max(0, value));
    return round2(discountBase * (pct / 100));
  }
  return 0;
}

function computeTaxAmount(order, subtotalBeforeTax) {
  if (!order.tax_enabled) return { tax_amount: 0, total_price: subtotalBeforeTax };
  const rate = Number(order.tax_rate) || 0;
  if (rate <= 0) return { tax_amount: 0, total_price: subtotalBeforeTax };

  if (order.prices_include_tax) {
    const total_price = subtotalBeforeTax;
    const tax_amount = round2(total_price * (rate / (100 + rate)));
    return { tax_amount, total_price };
  }
  const tax_amount = round2(subtotalBeforeTax * (rate / 100));
  const total_price = round2(subtotalBeforeTax + tax_amount);
  return { tax_amount, total_price };
}

async function recomputeOrderTotals(orderId) {
  const db = await getDB();
  const orders = await db.query("SELECT * FROM orders WHERE id = ?", [orderId]);
  const order = orders[0];
  if (!order) return null;

  const lines = await db.query("SELECT id, line_type, quantity, unit_price FROM order_lines WHERE order_id = ?", [
    orderId
  ]);

  let subtotalWorks = 0;
  let subtotalProducts = 0;
  for (const line of lines) {
    const qty = Number(line.quantity) || 0;
    const price = Number(line.unit_price) || 0;
    const lineTotal = round2(qty * price);
    await db.query("UPDATE order_lines SET total = ? WHERE id = ?", [lineTotal, line.id]);
    if (line.line_type === "work") subtotalWorks += lineTotal;
    else subtotalProducts += lineTotal;
  }
  subtotalWorks = round2(subtotalWorks);
  subtotalProducts = round2(subtotalProducts);

  const discount_amount = computeDiscountAmount(order, subtotalWorks, subtotalProducts);
  const subtotal_before_tax = round2(subtotalWorks + subtotalProducts - discount_amount);
  const { tax_amount, total_price } = computeTaxAmount(order, subtotal_before_tax);

  await db.query(
    `
    UPDATE orders SET
      subtotal_works = ?,
      subtotal_products = ?,
      discount_amount = ?,
      subtotal_before_tax = ?,
      tax_amount = ?,
      total_price = ?,
      updated_at = datetime('now')
    WHERE id = ?
  `,
    [subtotalWorks, subtotalProducts, discount_amount, subtotal_before_tax, tax_amount, total_price, orderId]
  );

  return {
    subtotal_works: subtotalWorks,
    subtotal_products: subtotalProducts,
    discount_amount,
    subtotal_before_tax,
    tax_amount,
    total_price
  };
}

async function getPaidAmount(db, orderId) {
  const rows = await db.query(
    `
    SELECT
      COALESCE(SUM(CASE WHEN kind = 'payment' THEN amount ELSE 0 END), 0) -
      COALESCE(SUM(CASE WHEN kind = 'refund' THEN amount ELSE 0 END), 0) AS paid
    FROM payments WHERE order_id = ?
  `,
    [orderId]
  );
  return round2(Number(rows[0]?.paid) || 0);
}

module.exports = { recomputeOrderTotals, getPaidAmount, computeDiscountAmount, computeTaxAmount };
