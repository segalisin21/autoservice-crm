const express = require("express");

const { getDB } = require("../config/database");
const { applyMigrations } = require("../config/migrations");
const { seedDefaultPermissions } = require("../config/permissions");
const { ensureDefaultSettings } = require("../lib/settings");
const { verifyPassword } = require("../lib/password");

const router = express.Router();

router.get("/login", (req, res) => {
  res.status(200).render("login", { error: null });
});

router.post("/login", async (req, res) => {
  const { username, password } = req.body || {};
  if (typeof username !== "string" || typeof password !== "string") {
    return res.status(400).render("login", { error: "Неверный логин или пароль" });
  }

  const db = await getDB();
  await applyMigrations(db);
  await seedDefaultPermissions(db);
  await ensureDefaultSettings(db);
  const rows = await db.query(
    "SELECT id, username, name, role, password_hash, is_active FROM users WHERE username = ? LIMIT 1",
    [username]
  );
  const user = rows[0];
  if (!user || !verifyPassword(password, user.password_hash)) {
    return res.status(401).render("login", { error: "Неверный логин или пароль" });
  }
  if (!user.is_active) {
    return res.status(403).render("login", { error: "Пользователь отключён" });
  }
  req.session.user = { id: user.id, username: user.username, name: user.name, role: user.role };
  return res.redirect("/");
});

router.post("/logout", (req, res) => {
  req.session = null;
  return res.redirect("/login");
});

module.exports = router;

