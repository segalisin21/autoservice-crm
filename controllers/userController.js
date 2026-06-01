const { getDB } = require("../config/database");
const { sqlNow } = require("../config/sqlDialect");
const { hashPassword } = require("../lib/password");
const { clearPermissionCache } = require("../config/permissions");

const ROLES = ["owner", "admin", "master"];
const ROLE_LABELS = { owner: "Владелец", admin: "Администратор", master: "Мастер" };

function normalizeRole(value) {
  const v = String(value ?? "").trim().toLowerCase();
  return ROLES.includes(v) ? v : "master";
}

async function list(req, res) {
  const db = await getDB();
  const users = await db.query(
    "SELECT id, username, name, role, is_active, created_at FROM users ORDER BY is_active DESC, name"
  );
  res.render("admin/users", {
    users,
    roles: ROLES,
    roleLabels: ROLE_LABELS,
    error: null,
    user: req.session.user,
    category: "users"
  });
}

async function create(req, res) {
  const db = await getDB();
  const username = String(req.body.username ?? "").trim().toLowerCase();
  const name = String(req.body.name ?? "").trim();
  const role = normalizeRole(req.body.role);
  const password = String(req.body.password ?? "");

  async function renderError(error) {
    const users = await db.query(
      "SELECT id, username, name, role, is_active, created_at FROM users ORDER BY is_active DESC, name"
    );
    return res.status(400).render("admin/users", {
      users,
      roles: ROLES,
      roleLabels: ROLE_LABELS,
      error,
      user: req.session.user,
      category: "users"
    });
  }

  if (!/^[a-z0-9_.-]{3,64}$/.test(username)) {
    return renderError("Логин: 3-64 символа (латиница, цифры, _.-)");
  }
  if (!name || name.length > 200) return renderError("Укажите имя сотрудника");
  if (password.length < 4) return renderError("Пароль не короче 4 символов");

  const existing = await db.query("SELECT id FROM users WHERE username = ?", [username]);
  if (existing.length) return renderError("Такой логин уже занят");

  await db.query(
    `INSERT INTO users(username, password_hash, name, role, is_active) VALUES (?, ?, ?, ?, 1)`,
    [username, hashPassword(password), name, role]
  );
  return res.redirect("/admin/users");
}

async function showEdit(req, res) {
  const db = await getDB();
  const id = Number(req.params.id);
  const rows = await db.query("SELECT id, username, name, role, is_active FROM users WHERE id = ?", [id]);
  const target = rows[0];
  if (!target) return res.status(404).send("Not found");
  res.render("admin/user-form", {
    target,
    roles: ROLES,
    roleLabels: ROLE_LABELS,
    error: null,
    user: req.session.user,
    category: "users"
  });
}

async function update(req, res) {
  const db = await getDB();
  const id = Number(req.params.id);
  const rows = await db.query("SELECT id, role FROM users WHERE id = ?", [id]);
  if (!rows.length) return res.status(404).send("Not found");

  const name = String(req.body.name ?? "").trim();
  const role = normalizeRole(req.body.role);
  const is_active = req.body.is_active ? 1 : 0;
  const password = String(req.body.password ?? "");

  if (!name) return res.redirect(`/admin/users/${id}/edit`);

  const now = sqlNow(db.dialect);
  await db.query(
    `UPDATE users SET name = ?, role = ?, is_active = ?, updated_at = ${now} WHERE id = ?`,
    [name, role, is_active, id]
  );
  if (password && password.length >= 4) {
    await db.query("UPDATE users SET password_hash = ? WHERE id = ?", [hashPassword(password), id]);
  }
  clearPermissionCache();
  return res.redirect("/admin/users");
}

async function toggleActive(req, res) {
  const db = await getDB();
  const id = Number(req.params.id);
  if (id === req.session.user.id) return res.redirect("/admin/users");
  const rows = await db.query("SELECT is_active FROM users WHERE id = ?", [id]);
  if (!rows.length) return res.status(404).send("Not found");
  const now = sqlNow(db.dialect);
  await db.query(`UPDATE users SET is_active = ?, updated_at = ${now} WHERE id = ?`, [
    rows[0].is_active ? 0 : 1,
    id
  ]);
  return res.redirect("/admin/users");
}

module.exports = { list, create, showEdit, update, toggleActive };
