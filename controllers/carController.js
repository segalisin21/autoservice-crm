const { getDB } = require("../config/database");
const { sqlNow } = require("../config/sqlDialect");
const { normalizePlate, normalizeVin } = require("../lib/normalize");

const PAGE_SIZE = 50;

function parseCarBody(body) {
  const make = String(body.make ?? "").trim() || null;
  const model = String(body.model ?? "").trim() || null;
  const color = String(body.color ?? "").trim() || null;
  const notes = String(body.notes ?? "").trim() || null;
  const vin = normalizeVin(body.vin);
  const yearRaw = String(body.year ?? "").trim();
  const year = yearRaw ? Number(yearRaw) : null;
  const mileageRaw = String(body.mileage ?? "").trim();
  const mileage = mileageRaw ? Number(mileageRaw) : null;
  const client_id = Number(body.client_id);
  const plate = normalizePlate(body.license_plate_raw);
  return {
    client_id,
    make,
    model,
    vin,
    year: Number.isFinite(year) ? year : null,
    color,
    mileage: Number.isFinite(mileage) ? mileage : null,
    notes,
    license_plate_raw: plate.license_plate_raw,
    license_plate_normalized: plate.license_plate_normalized
  };
}

function validateCar(data) {
  if (!Number.isFinite(data.client_id) || data.client_id <= 0) return "Выберите клиента";
  if (data.make && data.make.length > 100) return "Марка слишком длинная";
  if (data.model && data.model.length > 100) return "Модель слишком длинная";
  return null;
}

async function listClientsForSelect(db) {
  return db.query("SELECT id, full_name, phone_raw FROM clients ORDER BY full_name LIMIT 500");
}

async function list(req, res) {
  const db = await getDB();
  const search = String(req.query.search ?? "").trim();
  const page = Math.max(1, Number(req.query.page) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  let cars;
  if (search) {
    const digits = search.replace(/\D/g, "");
    const like = `%${search}%`;
    const likePlate = `%${search.toUpperCase().replace(/[\s-]/g, "")}%`;
    const likePhone = `%${digits || search}%`;
    cars = await db.query(
      `
      SELECT c.id, c.client_id, c.make, c.model, c.license_plate_raw, c.vin, c.year,
             cl.full_name AS client_name, cl.phone_raw AS client_phone
      FROM cars c
      JOIN clients cl ON cl.id = c.client_id
      WHERE c.make LIKE ? OR c.model LIKE ? OR c.vin LIKE ?
         OR c.license_plate_normalized LIKE ?
         OR cl.phone_normalized LIKE ?
      ORDER BY c.id DESC
      LIMIT ? OFFSET ?
    `,
      [like, like, like, likePlate, likePhone, PAGE_SIZE, offset]
    );
  } else {
    cars = await db.query(
      `
      SELECT c.id, c.client_id, c.make, c.model, c.license_plate_raw, c.vin, c.year,
             cl.full_name AS client_name, cl.phone_raw AS client_phone
      FROM cars c
      JOIN clients cl ON cl.id = c.client_id
      ORDER BY c.id DESC
      LIMIT ? OFFSET ?
    `,
      [PAGE_SIZE, offset]
    );
  }

  res.render("cars/list", { cars, search, user: req.session.user });
}

async function showNew(req, res) {
  const db = await getDB();
  const clients = await listClientsForSelect(db);
  res.render("cars/form", {
    car: { client_id: req.query.client_id || "" },
    clients,
    error: null,
    user: req.session.user
  });
}

async function create(req, res) {
  const data = parseCarBody(req.body);
  const error = validateCar(data);
  const db = await getDB();
  const clients = await listClientsForSelect(db);
  if (error) {
    return res.status(400).render("cars/form", { car: data, clients, error, user: req.session.user });
  }

  const id = await db.insertReturning(
    `
    INSERT INTO cars(
      client_id, make, model, vin, license_plate_raw, license_plate_normalized,
      year, color, mileage, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,
    [
      data.client_id,
      data.make,
      data.model,
      data.vin,
      data.license_plate_raw,
      data.license_plate_normalized,
      data.year,
      data.color,
      data.mileage,
      data.notes
    ]
  );
  return res.redirect(`/cars/${id}`);
}

async function show(req, res) {
  const db = await getDB();
  const id = Number(req.params.id);
  const rows = await db.query(
    `
    SELECT c.*, cl.full_name AS client_name, cl.phone_raw AS client_phone, cl.id AS client_id
    FROM cars c
    JOIN clients cl ON cl.id = c.client_id
    WHERE c.id = ?
  `,
    [id]
  );
  const car = rows[0];
  if (!car) return res.status(404).send("Not found");

  const reminders = await db.query(
    "SELECT * FROM car_reminders WHERE car_id = ? ORDER BY is_done ASC, due_date ASC",
    [id]
  );

  res.render("cars/show", { car, reminders, user: req.session.user });
}

async function showEdit(req, res) {
  const db = await getDB();
  const id = Number(req.params.id);
  const rows = await db.query("SELECT * FROM cars WHERE id = ?", [id]);
  const car = rows[0];
  if (!car) return res.status(404).send("Not found");
  const clients = await listClientsForSelect(db);
  res.render("cars/form", { car, clients, error: null, user: req.session.user });
}

async function update(req, res) {
  const id = Number(req.params.id);
  const data = parseCarBody(req.body);
  const error = validateCar(data);
  const db = await getDB();
  const clients = await listClientsForSelect(db);
  if (error) {
    return res.status(400).render("cars/form", { car: { ...data, id }, clients, error, user: req.session.user });
  }

  const now = sqlNow(db.dialect);
  await db.query(
    `
    UPDATE cars SET
      client_id = ?, make = ?, model = ?, vin = ?,
      license_plate_raw = ?, license_plate_normalized = ?,
      year = ?, color = ?, mileage = ?, notes = ?,
      updated_at = ${now}
    WHERE id = ?
  `,
    [
      data.client_id,
      data.make,
      data.model,
      data.vin,
      data.license_plate_raw,
      data.license_plate_normalized,
      data.year,
      data.color,
      data.mileage,
      data.notes,
      id
    ]
  );
  return res.redirect(`/cars/${id}`);
}

async function remove(req, res) {
  const db = await getDB();
  await db.query("DELETE FROM cars WHERE id = ?", [Number(req.params.id)]);
  return res.redirect("/cars");
}

async function addReminder(req, res) {
  const carId = Number(req.params.id);
  const title = String(req.body.title ?? "").trim();
  const due_date = String(req.body.due_date ?? "").trim() || null;
  const notes = String(req.body.notes ?? "").trim() || null;
  if (!title) return res.redirect(`/cars/${carId}`);

  const db = await getDB();
  await db.query(
    "INSERT INTO car_reminders(car_id, title, due_date, notes) VALUES (?, ?, ?, ?)",
    [carId, title, due_date, notes]
  );
  return res.redirect(`/cars/${carId}`);
}

async function toggleReminder(req, res) {
  const rid = Number(req.params.rid);
  const db = await getDB();
  const rows = await db.query("SELECT car_id, is_done FROM car_reminders WHERE id = ?", [rid]);
  const row = rows[0];
  if (!row) return res.status(404).send("Not found");
  await db.query("UPDATE car_reminders SET is_done = ? WHERE id = ?", [row.is_done ? 0 : 1, rid]);
  return res.redirect(`/cars/${row.car_id}`);
}

async function deleteReminder(req, res) {
  const rid = Number(req.params.rid);
  const db = await getDB();
  const rows = await db.query("SELECT car_id FROM car_reminders WHERE id = ?", [rid]);
  const row = rows[0];
  if (!row) return res.status(404).send("Not found");
  await db.query("DELETE FROM car_reminders WHERE id = ?", [rid]);
  return res.redirect(`/cars/${row.car_id}`);
}

module.exports = {
  list,
  showNew,
  create,
  show,
  showEdit,
  update,
  remove,
  addReminder,
  toggleReminder,
  deleteReminder
};
