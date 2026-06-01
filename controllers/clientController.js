const { getDB } = require("../config/database");
const { normalizePhone } = require("../lib/normalize");

const PAGE_SIZE = 50;

function parseClientBody(body) {
  const full_name = String(body.full_name ?? "").trim();
  const email = String(body.email ?? "").trim() || null;
  const notes = String(body.notes ?? "").trim() || null;
  const { phone_raw, phone_normalized } = normalizePhone(body.phone);
  return { full_name, email, notes, phone_raw, phone_normalized };
}

function validateClient(data) {
  if (!data.full_name || data.full_name.length > 200) return "Укажите ФИО (до 200 символов)";
  if (!data.phone_raw || data.phone_normalized.length < 10) return "Укажите корректный телефон";
  if (data.email && data.email.length > 200) return "Email слишком длинный";
  return null;
}

async function list(req, res) {
  const db = await getDB();
  const search = String(req.query.search ?? "").trim();
  const page = Math.max(1, Number(req.query.page) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  let rows;
  if (search) {
    const digits = search.replace(/\D/g, "");
    const likeName = `%${search}%`;
    const likePhone = `%${digits || search}%`;
    rows = await db.query(
      `
      SELECT id, full_name, phone_raw, phone_normalized, email, created_at
      FROM clients
      WHERE full_name LIKE ? OR phone_normalized LIKE ?
      ORDER BY id DESC
      LIMIT ? OFFSET ?
    `,
      [likeName, likePhone, PAGE_SIZE, offset]
    );
  } else {
    rows = await db.query(
      `
      SELECT id, full_name, phone_raw, phone_normalized, email, created_at
      FROM clients
      ORDER BY id DESC
      LIMIT ? OFFSET ?
    `,
      [PAGE_SIZE, offset]
    );
  }

  res.render("clients/list", { clients: rows, search, user: req.session.user });
}

async function showNew(req, res) {
  res.render("clients/form", {
    client: null,
    error: null,
    user: req.session.user
  });
}

async function create(req, res) {
  const data = parseClientBody(req.body);
  const error = validateClient(data);
  if (error) {
    return res.status(400).render("clients/form", { client: data, error, user: req.session.user });
  }

  const db = await getDB();
  await db.query(
    `
    INSERT INTO clients(full_name, phone_raw, phone_normalized, email, notes)
    VALUES (?, ?, ?, ?, ?)
  `,
    [data.full_name, data.phone_raw, data.phone_normalized, data.email, data.notes]
  );
  const created = await db.query("SELECT id FROM clients ORDER BY id DESC LIMIT 1");
  return res.redirect(`/clients/${created[0].id}`);
}

async function show(req, res) {
  const db = await getDB();
  const id = Number(req.params.id);
  const rows = await db.query("SELECT * FROM clients WHERE id = ?", [id]);
  const client = rows[0];
  if (!client) return res.status(404).send("Not found");

  const cars = await db.query(
    "SELECT id, make, model, license_plate_raw, year FROM cars WHERE client_id = ? ORDER BY id DESC",
    [id]
  );

  res.render("clients/show", { client, cars, user: req.session.user });
}

async function showEdit(req, res) {
  const db = await getDB();
  const id = Number(req.params.id);
  const rows = await db.query("SELECT * FROM clients WHERE id = ?", [id]);
  const client = rows[0];
  if (!client) return res.status(404).send("Not found");
  res.render("clients/form", { client, error: null, user: req.session.user });
}

async function update(req, res) {
  const id = Number(req.params.id);
  const data = parseClientBody(req.body);
  const error = validateClient(data);
  if (error) {
    return res.status(400).render("clients/form", { client: { ...data, id }, error, user: req.session.user });
  }

  const db = await getDB();
  await db.query(
    `
    UPDATE clients SET
      full_name = ?, phone_raw = ?, phone_normalized = ?, email = ?, notes = ?,
      updated_at = datetime('now')
    WHERE id = ?
  `,
    [data.full_name, data.phone_raw, data.phone_normalized, data.email, data.notes, id]
  );
  return res.redirect(`/clients/${id}`);
}

async function remove(req, res) {
  const db = await getDB();
  await db.query("DELETE FROM clients WHERE id = ?", [Number(req.params.id)]);
  return res.redirect("/clients");
}

module.exports = {
  list,
  showNew,
  create,
  show,
  showEdit,
  update,
  remove
};
