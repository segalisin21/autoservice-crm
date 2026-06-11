const SCHEDULE_START_HOUR = 10;
const SCHEDULE_END_HOUR = 19;
const { sqlNow } = require("../config/sqlDialect");

const SCHEDULE_DAY_END_MINUTE = (SCHEDULE_END_HOUR + 1) * 60;

function normalizeTime(value) {
  if (value == null || value === "") return null;
  const s = String(value).trim();
  const m = s.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min) || h < 0 || h > 23 || min < 0 || min > 59) {
    return null;
  }
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

function timeToMinutes(value, fallbackHour) {
  const t = normalizeTime(value);
  if (!t) return fallbackHour * 60;
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function absenceIntervalMinutes(record) {
  if (Number(record.is_full_day)) {
    return { start: SCHEDULE_START_HOUR * 60, end: SCHEDULE_DAY_END_MINUTE };
  }
  const start = timeToMinutes(record.start_time, SCHEDULE_START_HOUR);
  let end = timeToMinutes(record.end_time, SCHEDULE_END_HOUR + 1);
  if (record.end_time == null || record.end_time === "") {
    end = SCHEDULE_DAY_END_MINUTE;
  } else if (end <= start) {
    end = Math.min(SCHEDULE_DAY_END_MINUTE, start + 60);
  }
  return { start, end };
}

function formatAbsenceLabel(record) {
  if (Number(record.is_full_day)) return "весь день";
  const start = normalizeTime(record.start_time) || `${String(SCHEDULE_START_HOUR).padStart(2, "0")}:00`;
  const end =
    normalizeTime(record.end_time) || `${String(SCHEDULE_END_HOUR + 1).padStart(2, "0")}:00`;
  return `${start}–${end}`;
}

function intervalsOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

function isHourAbsent(absences, userId, hour) {
  const uid = Number(userId);
  const hourStart = hour * 60;
  const hourEnd = hourStart + 60;
  return (absences || []).some((row) => {
    if (Number(row.user_id) !== uid) return false;
    const { start, end } = absenceIntervalMinutes(row);
    return intervalsOverlap(hourStart, hourEnd, start, end);
  });
}

function orderTimeIntervalMinutes(startTime, endTime) {
  if (!normalizeTime(startTime)) return null;
  const start = timeToMinutes(startTime, SCHEDULE_START_HOUR);
  let end = normalizeTime(endTime) ? timeToMinutes(endTime, SCHEDULE_END_HOUR + 1) : start + 60;
  if (end <= start) end = start + 60;
  return { start, end };
}

function orderOverlapsAbsence(absences, userId, startTime, endTime) {
  const uid = Number(userId);
  const userAbsences = (absences || []).filter((row) => Number(row.user_id) === uid);
  if (!userAbsences.length) return false;

  const orderInterval = orderTimeIntervalMinutes(startTime, endTime);
  if (!orderInterval) {
    return true;
  }

  return userAbsences.some((row) => {
    const { start, end } = absenceIntervalMinutes(row);
    return intervalsOverlap(orderInterval.start, orderInterval.end, start, end);
  });
}

function orderCardHasAbsenceConflict(absences, userId, startTime, endTime) {
  return orderOverlapsAbsence(absences, userId, startTime, endTime);
}

async function loadAbsencesForDate(db, dateStr) {
  const rows = await db.query(
    `
    SELECT sa.*, u.name AS user_name
    FROM staff_absences sa
    JOIN users u ON u.id = sa.user_id
    WHERE sa.absence_date = ?
    ORDER BY sa.user_id, sa.start_time, sa.id
  `,
    [dateStr]
  );
  return rows.map((row) => ({
    ...row,
    label: formatAbsenceLabel(row)
  }));
}

async function loadAbsenceDaysInMonth(db, year, monthIndex0) {
  const start = new Date(year, monthIndex0, 1).toISOString().slice(0, 10);
  const end = new Date(year, monthIndex0 + 1, 0).toISOString().slice(0, 10);
  const rows = await db.query(
    `
    SELECT DISTINCT absence_date AS d
    FROM staff_absences
    WHERE absence_date >= ? AND absence_date <= ?
  `,
    [start, end]
  );
  return new Set(rows.map((r) => r.d));
}

async function validateCanAssign(db, userId, scheduledDate, startTime, endTime) {
  if (!userId) return null;
  const absences = await loadAbsencesForDate(db, scheduledDate);
  if (orderOverlapsAbsence(absences, userId, startTime, endTime)) {
    return "Мастер отсутствует в это время";
  }
  return null;
}

function canManageAbsenceForUser(sessionUser, targetUserId) {
  if (!sessionUser) return false;
  const role = sessionUser.role;
  if (role === "admin" || role === "owner") return true;
  if (role === "master") return Number(sessionUser.id) === Number(targetUserId);
  return false;
}

function canDeleteAbsence(sessionUser, absence, targetUserId) {
  if (!sessionUser || !absence) return false;
  if (sessionUser.role === "admin" || sessionUser.role === "owner") return true;
  return Number(sessionUser.id) === Number(targetUserId);
}

async function insertAbsence(db, payload) {
  const now = sqlNow(db.dialect);
  const isFullDay = payload.is_full_day ? 1 : 0;
  const startTime = isFullDay ? null : normalizeTime(payload.start_time);
  const endTime = isFullDay ? null : normalizeTime(payload.end_time);

  return db.insertReturning(
    `
    INSERT INTO staff_absences(
      user_id, absence_date, start_time, end_time, is_full_day, note, created_by, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ${now})
  `,
    [
      payload.user_id,
      payload.absence_date,
      startTime,
      endTime,
      isFullDay,
      payload.note || null,
      payload.created_by || null
    ]
  );
}

function buildAbsentByHour(absences, userId) {
  const absentByHour = {};
  for (let h = SCHEDULE_START_HOUR; h <= SCHEDULE_END_HOUR; h++) {
    absentByHour[h] = isHourAbsent(absences, userId, h);
  }
  return absentByHour;
}

function masterHasAbsenceOnDate(absences, userId) {
  return (absences || []).some((row) => Number(row.user_id) === Number(userId));
}

module.exports = {
  normalizeTime,
  formatAbsenceLabel,
  isHourAbsent,
  orderOverlapsAbsence,
  orderCardHasAbsenceConflict,
  loadAbsencesForDate,
  loadAbsenceDaysInMonth,
  validateCanAssign,
  canManageAbsenceForUser,
  canDeleteAbsence,
  insertAbsence,
  buildAbsentByHour,
  masterHasAbsenceOnDate
};
