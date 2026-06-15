const { getDB } = require("../config/database");
const { loadScheduleMasters } = require("../lib/calendarData");
const {
  normalizeTime,
  canManageAbsenceForUser,
  canDeleteAbsence,
  insertAbsence,
  loadAbsencesForDate
} = require("../lib/staffAbsence");

function parseDateParam(raw) {
  const s = String(raw || "").slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return new Date().toISOString().slice(0, 10);
}

async function listAbsences(req, res, next) {
  try {
    const date = parseDateParam(req.query.date);
    const db = await getDB();
    const absences = await loadAbsencesForDate(db, date);
    res.json({ date, absences });
  } catch (err) {
    next(err);
  }
}

async function createAbsence(req, res) {
  const db = await getDB();
  const absence_date = parseDateParam(req.body.absence_date || req.query.date);
  const role = req.session.user?.role;
  const sessionUserId = Number(req.session.user.id);
  const requestedUserId = Number(req.body.user_id);

  if (role === "master" && requestedUserId && requestedUserId !== sessionUserId) {
    return res.status(403).send("Forbidden");
  }

  const user_id =
    role === "admin" || role === "owner"
      ? requestedUserId || sessionUserId
      : sessionUserId;
  const is_full_day = req.body.is_full_day === "1" || req.body.is_full_day === 1 || req.body.is_full_day === true;
  const note = String(req.body.note ?? "").trim() || null;

  if (!canManageAbsenceForUser(req.session.user, user_id)) {
    return res.status(403).send("Forbidden");
  }

  const staff = await loadScheduleMasters(db);
  if (!staff.some((s) => Number(s.id) === Number(user_id))) {
    return res.status(400).send("Недопустимый сотрудник");
  }

  if (!is_full_day) {
    const start = normalizeTime(req.body.start_time);
    const end = normalizeTime(req.body.end_time);
    if (!start || !end) {
      return res.redirect(`/?mode=day&date=${absence_date}&absence_error=time`);
    }
  }

  await insertAbsence(db, {
    user_id,
    absence_date,
    is_full_day,
    start_time: req.body.start_time,
    end_time: req.body.end_time,
    note,
    created_by: req.session.user.id
  });

  return res.redirect(`/?mode=day&date=${absence_date}`);
}

async function deleteAbsence(req, res) {
  const id = Number(req.params.id);
  const db = await getDB();
  const rows = await db.query("SELECT * FROM staff_absences WHERE id = ?", [id]);
  const absence = rows[0];
  if (!absence) return res.status(404).send("Not found");

  if (!canDeleteAbsence(req.session.user, absence, absence.user_id)) {
    return res.status(403).send("Forbidden");
  }

  await db.query("DELETE FROM staff_absences WHERE id = ?", [id]);
  const redirectDate = String(req.query.date || absence.absence_date).slice(0, 10);
  return res.redirect(`/?mode=day&date=${redirectDate}`);
}

async function reorderColumns(req, res) {
  const db = await getDB();
  const user_id = Number(req.body.user_id);
  const direction = String(req.body.direction || "").toLowerCase();
  const date = parseDateParam(req.body.date || req.query.date);

  if (!user_id || !["left", "right"].includes(direction)) {
    return res.status(400).send("Bad request");
  }

  const masters = await loadScheduleMasters(db);
  const idx = masters.findIndex((m) => Number(m.id) === user_id);
  if (idx < 0) return res.status(404).send("Not found");

  const swapIdx = direction === "left" ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= masters.length) {
    return res.redirect(`/?mode=day&date=${date}`);
  }

  const current = masters[idx];
  const neighbor = masters[swapIdx];
  await db.query("UPDATE users SET schedule_order = ? WHERE id = ?", [neighbor.schedule_order, current.id]);
  await db.query("UPDATE users SET schedule_order = ? WHERE id = ?", [current.schedule_order, neighbor.id]);

  return res.redirect(`/?mode=day&date=${date}`);
}

module.exports = { listAbsences, createAbsence, deleteAbsence, reorderColumns };
