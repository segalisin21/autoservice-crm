const express = require("express");

const { getDB } = require("../config/database");
const { verifyPassword } = require("../lib/password");
const { asyncRoute } = require("../middleware/asyncRoute");
const { loginLimiter } = require("../middleware/loginLimiter");

const router = express.Router();

function saveSession(req) {
  return new Promise((resolve, reject) => {
    req.session.save((err) => (err ? reject(err) : resolve()));
  });
}

function regenerateSession(req) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((err) => (err ? reject(err) : resolve()));
  });
}

router.get("/login", (req, res) => {
  res.status(200).render("login", { error: null });
});

router.post(
  "/login",
  loginLimiter,
  asyncRoute(async (req, res) => {
    const { username, password } = req.body || {};
    if (typeof username !== "string" || typeof password !== "string") {
      return res.status(400).render("login", { error: "Неверный логин или пароль" });
    }

    const db = await getDB();
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

    await regenerateSession(req);
    req.session.user = { id: user.id, username: user.username, name: user.name, role: user.role };
    await saveSession(req);
    return res.redirect("/");
  })
);

router.post("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).send("Internal server error");
    }
    res.clearCookie("connect.sid");
    return res.redirect("/login");
  });
});

module.exports = router;
