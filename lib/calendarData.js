const { getDB } = require("../config/database");
const { orderDateSql } = require("../config/sqlDialect");
const {
  loadAbsencesForDate,
  orderCardHasAbsenceConflict,
  buildAbsentByHour,
  masterHasAbsenceOnDate,
  formatAbsenceLabel
} = require("./staffAbsence");

function toDateStr(d) {
  return d.toISOString().slice(0, 10);
}

async function loadStaff(db) {
  return db.query(
    `SELECT id, name, username, role FROM users
     WHERE role IN ('master','manager','admin','owner') AND is_active = 1
     ORDER BY (role = 'master') DESC, name`
  );
}

async function loadScheduleMasters(db) {
  return db.query(
    `SELECT id, name, username, role, schedule_order FROM users
     WHERE is_active = 1 AND show_in_schedule = 1
     ORDER BY schedule_order ASC, name ASC`
  );
}

async function getMonthCalendar(year, monthIndex0) {
  const db = await getDB();
  const dateSql = orderDateSql(db.dialect);
  const start = new Date(year, monthIndex0, 1);
  const end = new Date(year, monthIndex0 + 1, 0);
  const startStr = toDateStr(start);
  const endStr = toDateStr(end);

  const rows = await db.query(
    `
    SELECT ${dateSql} AS d, COUNT(*) AS cnt, COALESCE(SUM(o.total_price), 0) AS revenue
    FROM orders o
    WHERE o.status != 'cancelled'
      AND ${dateSql} >= ?
      AND ${dateSql} <= ?
    GROUP BY d
  `,
    [startStr, endStr]
  );

  const absenceRows = await db.query(
    `
    SELECT absence_date AS d, COUNT(DISTINCT user_id) AS absence_count
    FROM staff_absences
    WHERE absence_date >= ? AND absence_date <= ?
    GROUP BY absence_date
  `,
    [startStr, endStr]
  );
  const byDate = new Map(rows.map((r) => [r.d, { count: Number(r.cnt), revenue: Number(r.revenue) }]));
  const absByDate = new Map(absenceRows.map((r) => [r.d, Number(r.absence_count) || 0]));

  const days = [];
  for (let day = 1; day <= end.getDate(); day++) {
    const d = new Date(year, monthIndex0, day);
    const date = toDateStr(d);
    const meta = byDate.get(date) || { count: 0, revenue: 0 };
    const absence_count = absByDate.get(date) || 0;
    days.push({
      date,
      day,
      weekday: d.getDay(),
      booking_count: meta.count,
      revenue: meta.revenue,
      has_absence: absence_count > 0,
      absence_count
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

function decorateOrderCard(row, absences, assignedOverride = null) {
  const carLabel =
    [row.make, row.model].filter(Boolean).join(" ") ||
    row.license_plate_raw ||
    "Запись";
  const start_time = hhmm(row.start_time);
  const end_time = hhmm(row.end_time);
  const assigned_user_id =
    assignedOverride != null
      ? Number(assignedOverride)
      : row.assigned_user_id != null
        ? Number(row.assigned_user_id)
        : null;
  return {
    id: row.id,
    status: row.status,
    work_type: row.work_type,
    total_price: Number(row.total_price) || 0,
    car_label: carLabel,
    license_plate: row.license_plate_raw || "",
    client_name: row.client_name || "",
    client_phone: row.client_phone,
    start_time,
    end_time,
    notes: row.notes,
    assigned_user_id,
    absence_conflict: assigned_user_id
      ? orderCardHasAbsenceConflict(absences, assigned_user_id, start_time, end_time)
      : false
  };
}

async function getDayByEmployees(dateStr) {
  const db = await getDB();
  const dateSql = orderDateSql(db.dialect);
  const staff = await loadScheduleMasters(db);
  const absences = await loadAbsencesForDate(db, dateStr);
  const columns = staff.map((s) => ({
    id: s.id,
    name: s.name,
    role: s.role,
    orders: [],
    absences: absences.filter((a) => Number(a.user_id) === Number(s.id)),
    has_absence: masterHasAbsenceOnDate(absences, s.id),
    absence_labels: absences
      .filter((a) => Number(a.user_id) === Number(s.id))
      .map((a) => a.label || formatAbsenceLabel(a))
  }));
  const byId = new Map(columns.map((c) => [c.id, c]));

  const rows = await db.query(
    `
    SELECT o.id, o.status, o.work_type, o.total_price, o.notes,
           o.assigned_user_id, o.start_time, o.end_time,
           c.make, c.model, c.license_plate_raw,
           cl.full_name AS client_name, cl.phone_raw AS client_phone
    FROM orders o
    LEFT JOIN cars c ON c.id = o.car_id
    LEFT JOIN clients cl ON cl.id = c.client_id
    WHERE o.status != 'cancelled'
      AND ${dateSql} = ?
    ORDER BY COALESCE(o.start_time, '99:99'), o.id
  `,
    [dateStr]
  );

  const orderIds = rows.map((r) => Number(r.id)).filter((id) => Number.isFinite(id) && id > 0);
  const orderMastersMap = new Map();
  if (orderIds.length) {
    const placeholders = orderIds.map(() => "?").join(", ");
    const masterRows = await db.query(
      `
      SELECT ol.order_id, COALESCE(olp.user_id, ol.master_id) AS user_id
      FROM order_lines ol
      LEFT JOIN order_line_payroll olp ON olp.order_line_id = ol.id
      WHERE ol.order_id IN (${placeholders})
        AND ol.line_type = 'work'
        AND COALESCE(olp.user_id, ol.master_id) IS NOT NULL
    `,
      orderIds
    );
    for (const mr of masterRows) {
      const orderId = Number(mr.order_id);
      const userId = Number(mr.user_id);
      if (!Number.isFinite(orderId) || !Number.isFinite(userId) || userId <= 0) continue;
      if (!orderMastersMap.has(orderId)) orderMastersMap.set(orderId, new Set());
      orderMastersMap.get(orderId).add(userId);
    }
  }

  const unassigned = [];
  for (const row of rows) {
    const orderId = Number(row.id);
    const lineMasters = orderMastersMap.get(orderId);
    const masterIds =
      lineMasters && lineMasters.size
        ? Array.from(lineMasters)
        : Number(row.assigned_user_id)
          ? [Number(row.assigned_user_id)]
          : [];
    if (masterIds.length) {
      let assignedToAny = false;
      for (const masterId of masterIds) {
        const col = byId.get(masterId);
        if (!col) continue;
        col.orders.push(decorateOrderCard(row, absences, masterId));
        assignedToAny = true;
      }
      if (!assignedToAny) {
        unassigned.push(decorateOrderCard(row, absences));
      }
    } else {
      unassigned.push(decorateOrderCard(row, absences));
    }
  }

  return { date: dateStr, employees: columns, unassigned, absences };
}

async function getDayStats(dateStr) {
  const db = await getDB();
  const dateSql = orderDateSql(db.dialect);
  const rows = await db.query(
    `
    SELECT COUNT(*) AS cnt, COALESCE(SUM(total_price), 0) AS revenue
    FROM orders o
    WHERE status != 'cancelled' AND ${dateSql} = ?
  `,
    [dateStr]
  );
  const busy = await db.query(
    `
    SELECT COUNT(DISTINCT assigned_user_id) AS busy
    FROM orders o
    WHERE status NOT IN ('cancelled', 'completed') AND assigned_user_id IS NOT NULL AND ${dateSql} = ?
  `,
    [dateStr]
  );
  const staff = await loadScheduleMasters(db);
  return {
    count: Number(rows[0]?.cnt) || 0,
    revenue: Number(rows[0]?.revenue) || 0,
    employees_busy: Number(busy[0]?.busy) || 0,
    employees_total: staff.length
  };
}

const SCHEDULE_START_HOUR = 10;
const SCHEDULE_END_HOUR = 19;

function parseHourFromTime(t) {
  if (t == null) return null;
  const m = String(t).trim().match(/^(\d{1,2})/);
  if (!m) return null;
  const h = Number(m[1]);
  if (!Number.isFinite(h) || h < SCHEDULE_START_HOUR || h > SCHEDULE_END_HOUR) return null;
  return h;
}

function parseMinutesFromTime(t) {
  if (t == null) return null;
  const m = String(t).trim().match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const h = Number(m[1]);
  const mm = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(mm) || h < 0 || h > 23 || mm < 0 || mm > 59) return null;
  return h * 60 + mm;
}

function calcSpanRows(startTime, endTime) {
  // end_time is exclusive boundary: 10:00–13:00 occupies hour slots 10, 11, 12.
  const startMin = parseMinutesFromTime(startTime);
  if (startMin == null) return 1;
  const endMin = parseMinutesFromTime(endTime);
  if (endMin == null || endMin <= startMin) return 1;
  const spanHours = Math.ceil((endMin - startMin) / 60);
  return Math.max(1, spanHours);
}

function buildHourSlots() {
  const slots = [];
  for (let h = SCHEDULE_START_HOUR; h <= SCHEDULE_END_HOUR; h++) {
    slots.push({ hour: h, label: `${String(h).padStart(2, "0")}:00` });
  }
  return slots;
}

function assignOrdersToTimeSlots(dayData) {
  const hours = buildHourSlots();
  const noTime = [];
  const absences = dayData.absences || [];

  for (const o of dayData.unassigned || []) {
    noTime.push(o);
  }

  const columns = (dayData.employees || []).map((emp) => {
    const byHour = {};
    const coveredBySpan = {};
    const absentByHour = buildAbsentByHour(absences, emp.id);
    for (const slot of hours) {
      byHour[slot.hour] = [];
      coveredBySpan[slot.hour] = false;
    }
    for (const o of emp.orders || []) {
      const h = parseHourFromTime(o.start_time);
      if (h != null && byHour[h]) {
        const span_rows = Math.min(calcSpanRows(o.start_time, o.end_time), SCHEDULE_END_HOUR - h + 1);
        byHour[h].push({ ...o, span_rows });
        for (let offset = 1; offset < span_rows; offset++) {
          const nextHour = h + offset;
          if (coveredBySpan[nextHour] != null) coveredBySpan[nextHour] = true;
        }
      }
      else noTime.push(o);
    }
    return {
      id: emp.id,
      name: emp.name,
      role: emp.role,
      byHour,
      coveredBySpan,
      absentByHour,
      has_absence: emp.has_absence,
      absence_labels: emp.absence_labels || []
    };
  });

  return { hours, columns, noTime };
}

module.exports = {
  getMonthCalendar,
  getDayByEmployees,
  getDayStats,
  loadStaff,
  loadScheduleMasters,
  SCHEDULE_START_HOUR,
  SCHEDULE_END_HOUR,
  assignOrdersToTimeSlots
};
