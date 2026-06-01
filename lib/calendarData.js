const { getDB } = require("../config/database");

function toDateStr(d) {
  return d.toISOString().slice(0, 10);
}

async function loadStaff(db) {
  return db.query(
    `SELECT id, name, username, role FROM users
     WHERE role IN ('master','admin','owner') AND is_active = 1
     ORDER BY (role = 'master') DESC, name`
  );
}

function orderDateSql() {
  return "COALESCE(o.scheduled_date, date(o.opened_at))";
}

async function getMonthCalendar(year, monthIndex0) {
  const db = await getDB();
  const start = new Date(year, monthIndex0, 1);
  const end = new Date(year, monthIndex0 + 1, 0);
  const startStr = toDateStr(start);
  const endStr = toDateStr(end);

  const rows = await db.query(
    `
    SELECT ${orderDateSql()} AS d, COUNT(*) AS cnt, COALESCE(SUM(o.total_price), 0) AS revenue
    FROM orders o
    WHERE o.status != 'cancelled'
      AND ${orderDateSql()} >= ?
      AND ${orderDateSql()} <= ?
    GROUP BY d
  `,
    [startStr, endStr]
  );

  const byDate = new Map(rows.map((r) => [r.d, { count: Number(r.cnt), revenue: Number(r.revenue) }]));

  const days = [];
  for (let day = 1; day <= end.getDate(); day++) {
    const d = new Date(year, monthIndex0, day);
    const date = toDateStr(d);
    const meta = byDate.get(date) || { count: 0, revenue: 0 };
    days.push({
      date,
      day,
      weekday: d.getDay(),
      booking_count: meta.count,
      revenue: meta.revenue
    });
  }

  return {
    year,
    month: monthIndex0,
    monthStart: startStr,
    days
  };
}

function hhmm(t) {
  if (t == null) return null;
  const s = String(t).trim();
  if (/^\d{2}:\d{2}/.test(s)) return s.slice(0, 5);
  return s || null;
}

async function getDayByEmployees(dateStr) {
  const db = await getDB();
  const staff = await loadStaff(db);
  const columns = staff.map((s) => ({ id: s.id, name: s.name, role: s.role, orders: [] }));
  const byId = new Map(columns.map((c) => [c.id, c]));

  const rows = await db.query(
    `
    SELECT o.id, o.status, o.work_type, o.total_price, o.notes,
           o.assigned_user_id, o.start_time, o.end_time,
           c.make, c.model, c.license_plate_raw,
           cl.full_name AS client_name, cl.phone_raw AS client_phone
    FROM orders o
    JOIN cars c ON c.id = o.car_id
    JOIN clients cl ON cl.id = c.client_id
    WHERE o.status != 'cancelled'
      AND ${orderDateSql()} = ?
    ORDER BY COALESCE(o.start_time, '99:99'), o.id
  `,
    [dateStr]
  );

  const unassigned = [];
  for (const row of rows) {
    const carLabel =
      [row.make, row.model].filter(Boolean).join(" ") ||
      row.license_plate_raw ||
      "Авто";
    const card = {
      id: row.id,
      status: row.status,
      work_type: row.work_type,
      total_price: Number(row.total_price) || 0,
      car_label: carLabel,
      license_plate: row.license_plate_raw || "",
      client_name: row.client_name,
      client_phone: row.client_phone,
      start_time: hhmm(row.start_time),
      end_time: hhmm(row.end_time),
      notes: row.notes
    };
    const col = byId.get(Number(row.assigned_user_id));
    if (col) col.orders.push(card);
    else unassigned.push(card);
  }

  return { date: dateStr, employees: columns, unassigned };
}

async function getDayStats(dateStr) {
  const db = await getDB();
  const rows = await db.query(
    `
    SELECT COUNT(*) AS cnt, COALESCE(SUM(total_price), 0) AS revenue
    FROM orders o
    WHERE status != 'cancelled' AND ${orderDateSql()} = ?
  `,
    [dateStr]
  );
  const busy = await db.query(
    `
    SELECT COUNT(DISTINCT assigned_user_id) AS busy
    FROM orders o
    WHERE status NOT IN ('cancelled', 'completed') AND assigned_user_id IS NOT NULL AND ${orderDateSql()} = ?
  `,
    [dateStr]
  );
  const staff = await loadStaff(db);
  return {
    count: Number(rows[0]?.cnt) || 0,
    revenue: Number(rows[0]?.revenue) || 0,
    employees_busy: Number(busy[0]?.busy) || 0,
    employees_total: staff.length
  };
}

module.exports = { getMonthCalendar, getDayByEmployees, getDayStats, loadStaff, orderDateSql };
