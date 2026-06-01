/**
 * Сводка после импорта учёта: заказы, клиенты, каталог, ЗП.
 * Запуск: node scripts/verify-uchet-import.js
 */
const { getDB } = require("../config/database");

async function main() {
  const db = await getDB();
  const [orders, clients, cars, catalog, payments, earned] = await Promise.all([
    db.query("SELECT COUNT(*) AS c FROM orders"),
    db.query("SELECT COUNT(*) AS c FROM clients"),
    db.query("SELECT COUNT(*) AS c FROM cars"),
    db.query("SELECT COUNT(*) AS c FROM catalog_items"),
    db.query("SELECT COALESCE(SUM(amount), 0) AS s FROM payments WHERE kind = 'payment'"),
    db.query(
      "SELECT COALESCE(SUM(master_earned_amount), 0) AS s FROM order_lines WHERE line_type = 'work'"
    )
  ]);
  const byStatus = await db.query(
    "SELECT status, COUNT(*) AS c FROM orders GROUP BY status ORDER BY c DESC"
  );
  await db.close();

  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      {
        orders: Number(orders[0].c),
        clients: Number(clients[0].c),
        cars: Number(cars[0].c),
        catalog_items: Number(catalog[0].c),
        payments_sum: Number(payments[0].s),
        payroll_earned_sum: Number(earned[0].s),
        orders_by_status: byStatus
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err.message || err);
  process.exitCode = 1;
});
