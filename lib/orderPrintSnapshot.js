const { parseMoney, round2 } = require("./money");
function mapLineFromOrder(l) {
  return {
    name: String(l.name ?? "").trim(),
    notes: String(l.notes ?? "").trim(),
    quantity: String(l.quantity ?? 1),
    unit_price: round2(parseMoney(l.unit_price)).toFixed(2),
    total: round2(parseMoney(l.total)).toFixed(2)
  };
}

function buildSnapshotFromOrder(ctx, printDate) {
  const { order, works, products } = ctx;
  return {
    doc_date: printDate,
    client_name: String(order.client_name ?? "").trim(),
    client_phone: String(order.client_phone ?? "").trim(),
    car_make: String(order.make ?? "").trim(),
    car_model: String(order.model ?? "").trim(),
    car_year: order.year != null && order.year !== "" ? String(order.year) : "",
    license_plate: String(order.license_plate_raw ?? "").trim(),
    vin: String(order.vin ?? "").trim(),
    mileage: order.mileage != null && order.mileage !== "" ? String(order.mileage) : "",
    scheduled_date: String(order.scheduled_date || order.opened_at || "").slice(0, 10),
    scheduled_end_date: order.scheduled_end_date ? String(order.scheduled_end_date).slice(0, 10) : "",
    works: works.map(mapLineFromOrder),
    products: products.map(mapLineFromOrder),
    subtotal_works: round2(parseMoney(order.subtotal_works)).toFixed(2),
    subtotal_products: round2(parseMoney(order.subtotal_products)).toFixed(2),
    discount_amount: round2(parseMoney(order.discount_amount)).toFixed(2),
    total_price: round2(parseMoney(order.total_price)).toFixed(2)
  };
}

function parseLine(raw) {
  if (!raw || typeof raw !== "object") return null;
  const name = String(raw.name ?? "").trim();
  if (!name) return null;
  const quantity = parseMoney(raw.quantity) || 1;
  const unit_price = parseMoney(raw.unit_price);
  const total = raw.total != null && raw.total !== "" ? parseMoney(raw.total) : round2(quantity * unit_price);
  return {
    name: name.slice(0, 200),
    notes: String(raw.notes ?? "").trim().slice(0, 2000),
    quantity: String(quantity),
    unit_price: round2(unit_price).toFixed(2),
    total: round2(total).toFixed(2)
  };
}

function parseLines(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map(parseLine).filter(Boolean);
}

function parseSnapshotPayload(body) {
  let raw = body;
  if (body && typeof body.snapshot === "string" && body.snapshot.trim()) {
    try {
      raw = JSON.parse(body.snapshot);
    } catch {
      return null;
    }
  }
  if (!raw || typeof raw !== "object") return null;

  const works = parseLines(raw.works);
  const products = parseLines(raw.products);
  const subtotal_works = round2(
    works.reduce((s, l) => s + parseMoney(l.total), 0)
  ).toFixed(2);
  const subtotal_products = round2(
    products.reduce((s, l) => s + parseMoney(l.total), 0)
  ).toFixed(2);
  const discount_amount = round2(parseMoney(raw.discount_amount)).toFixed(2);
  const subtotal = parseMoney(subtotal_works) + parseMoney(subtotal_products);
  const total_price = round2(Math.max(0, subtotal - parseMoney(discount_amount))).toFixed(2);

  return {
    doc_date: String(raw.doc_date ?? "").trim().slice(0, 80),
    client_name: String(raw.client_name ?? "").trim().slice(0, 200),
    client_phone: String(raw.client_phone ?? "").trim().slice(0, 50),
    car_make: String(raw.car_make ?? "").trim().slice(0, 100),
    car_model: String(raw.car_model ?? "").trim().slice(0, 100),
    car_year: String(raw.car_year ?? "").trim().slice(0, 10),
    license_plate: String(raw.license_plate ?? "").trim().slice(0, 30),
    vin: String(raw.vin ?? "").trim().slice(0, 30),
    mileage: String(raw.mileage ?? "").trim().slice(0, 20),
    scheduled_date: String(raw.scheduled_date ?? "").trim().slice(0, 10),
    scheduled_end_date: String(raw.scheduled_end_date ?? "").trim().slice(0, 10),
    works,
    products,
    subtotal_works,
    subtotal_products,
    discount_amount,
    total_price
  };
}

async function loadPrintSnapshot(db, orderId) {
  try {
    const rows = await db.query("SELECT data FROM order_print_snapshots WHERE order_id = ?", [orderId]);
    if (!rows[0]?.data) return null;
    return JSON.parse(rows[0].data);
  } catch {
    return null;
  }
}

async function savePrintSnapshot(db, orderId, snapshot) {
  const now = db.dialect === "postgres" ? "NOW()" : "datetime('now')";
  const data = JSON.stringify(snapshot);
  await db.query(
    `
    INSERT INTO order_print_snapshots(order_id, data, updated_at)
    VALUES (?, ?, ${now})
    ON CONFLICT(order_id) DO UPDATE SET data = excluded.data, updated_at = ${now}
  `,
    [orderId, data]
  );
}

async function deletePrintSnapshot(db, orderId) {
  try {
    await db.query("DELETE FROM order_print_snapshots WHERE order_id = ?", [orderId]);
  } catch {
    // table may not exist in old DBs until migration
  }
}

module.exports = {
  buildSnapshotFromOrder,
  parseSnapshotPayload,
  loadPrintSnapshot,
  savePrintSnapshot,
  deletePrintSnapshot
};
