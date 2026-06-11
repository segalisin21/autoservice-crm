const { getDB } = require("../config/database");
const { getMonthCalendar, getDayByEmployees, getDayStats, assignOrdersToTimeSlots, loadStaff } = require("../lib/calendarData");
const { loadFinanceMetrics } = require("../lib/finance");

function parseDateParam(raw) {
  const s = String(raw || "").slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return new Date().toISOString().slice(0, 10);
}

function buildNav(d) {
  const prevDay = new Date(d);
  prevDay.setDate(prevDay.getDate() - 1);
  const nextDay = new Date(d);
  nextDay.setDate(nextDay.getDate() + 1);
  const year = d.getFullYear();
  const month = d.getMonth();
  const monthPrev = new Date(year, month - 1, 1);
  const monthNext = new Date(year, month + 1, 1);
  return {
    prevDay: prevDay.toISOString().slice(0, 10),
    nextDay: nextDay.toISOString().slice(0, 10),
    monthPrev: monthPrev.toISOString().slice(0, 10),
    monthNext: monthNext.toISOString().slice(0, 10)
  };
}

function emptyMonthCalendar(year, monthIndex0) {
  const start = new Date(year, monthIndex0, 1);
  const end = new Date(year, monthIndex0 + 1, 0);
  const days = [];
  for (let day = 1; day <= end.getDate(); day++) {
    const d = new Date(year, monthIndex0, day);
    days.push({
      date: d.toISOString().slice(0, 10),
      day,
      weekday: d.getDay(),
      booking_count: 0,
      revenue: 0,
      has_absence: false
    });
  }
  return {
    year,
    month: monthIndex0,
    monthStart: start.toISOString().slice(0, 10),
    days
  };
}

async function index(req, res, next) {
  const mode = String(req.query.mode || "month") === "day" ? "day" : "month";
  const today = parseDateParam(req.query.date);
  const d = new Date(`${today}T12:00:00`);
  const year = d.getFullYear();
  const month = d.getMonth();
  const nav = buildNav(d);

  let calendar = emptyMonthCalendar(year, month);
  let dayData = null;
  let timeGrid = null;
  let dayStats = { count: 0, revenue: 0, employees_busy: 0, employees_total: 0 };
  let finance = null;
  let loadError = null;
  let staffList = [];

  const showMoney = ["owner", "admin"].includes(req.session.user.role);
  const canManageAllAbsences = showMoney;

  try {
    const db = await getDB();
    calendar = await getMonthCalendar(year, month);
    dayStats = await getDayStats(today);
    if (mode === "day") {
      dayData = await getDayByEmployees(today);
      timeGrid = assignOrdersToTimeSlots(dayData);
      staffList = await loadStaff(db);
    }
    if (showMoney) {
      const monthStart = new Date(year, month, 1).toISOString().slice(0, 10);
      const monthEnd = new Date(year, month + 1, 0).toISOString().slice(0, 10);
      finance = await loadFinanceMetrics(db, monthStart, monthEnd);
    }
  } catch (err) {
    loadError = err.message || String(err);
    if (mode === "day") {
      dayData = { date: today, employees: [], unassigned: [] };
      timeGrid = assignOrdersToTimeSlots(dayData);
    }
  }

  res.render("dashboard", {
    title: mode === "day" ? "Расписание" : "Календарь",
    category: "dashboard",
    user: req.session.user,
    mode,
    today,
    calendar,
    dayData,
    timeGrid,
    dayStats,
    finance,
    showMoney,
    nav,
    loadError,
    staffList,
    canManageAllAbsences,
    absenceError: req.query.absence_error || null
  });
}

module.exports = { index };
