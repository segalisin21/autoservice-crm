const { round2, parseMoney } = require("./money");

async function sumEarnedForUser(db, userId, { start_date, end_date } = {}) {
  const params = [userId];
  let dateFilter = "";
  if (start_date && end_date) {
    dateFilter = " AND o.closed_at >= ? AND o.closed_at <= ?";
    params.push(`${start_date} 00:00:00`, `${end_date}T23:59:59`);
  }

  const lineRows = await db.query(
    `
    SELECT COALESCE(SUM(ol.master_earned_amount), 0) AS total
    FROM order_lines ol
    JOIN orders o ON o.id = ol.order_id
    WHERE ol.line_type = 'work' AND ol.master_id = ? AND o.status = 'completed'
      AND ol.master_earned_amount IS NOT NULL
      ${dateFilter}
  `,
    params
  );

  let payrollSum = 0;
  try {
    const prParams = [userId];
    let prDate = "";
    if (start_date && end_date) {
      prDate = " AND o.closed_at >= ? AND o.closed_at <= ?";
      prParams.push(`${start_date} 00:00:00`, `${end_date}T23:59:59`);
    }
    const pr = await db.query(
      `
      SELECT COALESCE(SUM(olp.earned_amount), 0) AS total
      FROM order_line_payroll olp
      JOIN order_lines ol ON ol.id = olp.order_line_id
      JOIN orders o ON o.id = ol.order_id
      WHERE olp.user_id = ? AND o.status = 'completed' AND olp.earned_amount IS NOT NULL
      ${prDate}
    `,
      prParams
    );
    payrollSum = Number(pr[0]?.total) || 0;
  } catch {
    payrollSum = 0;
  }

  const lineTotal = Number(lineRows[0]?.total) || 0;
  return round2(Math.max(lineTotal, payrollSum));
}

async function sumPaidForUser(db, userId, { start_date, end_date } = {}) {
  const params = [userId];
  let dateFilter = "";
  if (start_date && end_date) {
    dateFilter = " AND paid_at >= ? AND paid_at <= ?";
    params.push(`${start_date} 00:00:00`, `${end_date}T23:59:59`);
  }
  const rows = await db.query(
    `SELECT COALESCE(SUM(amount), 0) AS paid FROM payouts WHERE user_id = ? ${dateFilter}`,
    params
  );
  return parseMoney(rows[0]?.paid);
}

async function loadMasterPayrollBalances(db, { start_date, end_date, userIds } = {}) {
  let masters = await db.query(
    "SELECT id, name, username, role FROM users WHERE role IN ('master','admin','owner') AND is_active = 1 ORDER BY name"
  );
  if (userIds && userIds.length) {
    const set = new Set(userIds);
    masters = masters.filter((m) => set.has(m.id));
  }

  const rows = [];
  for (const m of masters) {
    const earned_period =
      start_date && end_date ? await sumEarnedForUser(db, m.id, { start_date, end_date }) : null;
    const paid_period =
      start_date && end_date ? await sumPaidForUser(db, m.id, { start_date, end_date }) : null;
    const earned_total = await sumEarnedForUser(db, m.id);
    const paid_total = await sumPaidForUser(db, m.id);
    rows.push({
      ...m,
      earned_period,
      paid_period,
      due_period: earned_period != null ? round2(earned_period - paid_period) : null,
      earned_total,
      paid_total,
      due_total: round2(earned_total - paid_total)
    });
  }
  return rows;
}

async function loadMasterEarnedLines(db, userId, { start_date, end_date, limit = 150 } = {}) {
  const params = [userId];
  let dateFilter = "";
  if (start_date && end_date) {
    dateFilter = " AND o.closed_at >= ? AND o.closed_at <= ?";
    params.push(`${start_date} 00:00:00`, `${end_date}T23:59:59`);
  }
  params.push(limit);

  return db.query(
    `
    SELECT
      ol.id AS line_id,
      ol.name AS line_name,
      ol.master_earned_amount AS earned,
      o.id AS order_id,
      o.closed_at,
      o.work_type,
      car.license_plate_raw,
      car.make AS car_make,
      cl.full_name AS client_name
    FROM order_lines ol
    JOIN orders o ON o.id = ol.order_id
    JOIN cars car ON car.id = o.car_id
    JOIN clients cl ON cl.id = car.client_id
    WHERE ol.line_type = 'work'
      AND ol.master_id = ?
      AND o.status = 'completed'
      AND ol.master_earned_amount IS NOT NULL
      ${dateFilter}
    ORDER BY o.closed_at DESC, ol.id DESC
    LIMIT ?
  `,
    params
  );
}

async function loadMasterPayoutsForUser(db, userId, { start_date, end_date, limit = 30 } = {}) {
  const params = [userId];
  let dateFilter = "";
  if (start_date && end_date) {
    dateFilter = " AND paid_at >= ? AND paid_at <= ?";
    params.push(`${start_date} 00:00:00`, `${end_date}T23:59:59`);
  }
  params.push(limit);
  return db.query(
    `
    SELECT id, amount, method, note, paid_at, period_start, period_end
    FROM payouts
    WHERE user_id = ? ${dateFilter}
    ORDER BY paid_at DESC, id DESC
    LIMIT ?
  `,
    params
  );
}

async function loadRecentPayouts(db, limit = 30) {
  return db.query(
    `
    SELECT p.*, u.name AS user_name
    FROM payouts p
    JOIN users u ON u.id = p.user_id
    ORDER BY p.paid_at DESC, p.id DESC
    LIMIT ?
  `,
    [limit]
  );
}

module.exports = {
  sumEarnedForUser,
  sumPaidForUser,
  loadMasterPayrollBalances,
  loadMasterEarnedLines,
  loadMasterPayoutsForUser,
  loadRecentPayouts
};
