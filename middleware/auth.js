const { getDB } = require("../config/database");
const { roleHasPermission } = require("../config/permissions");

function requireAuth(req, res, next) {
  if (req.session && req.session.user) return next();
  return res.redirect("/login");
}

function requireRole(role) {
  return (req, res, next) => {
    const user = req.session?.user;
    if (!user) return res.redirect("/login");
    if (user.role !== role) return res.status(403).send("Forbidden");
    return next();
  };
}

function requirePermission(permission) {
  return async (req, res, next) => {
    const user = req.session?.user;
    if (!user) return res.redirect("/login");
    if (user.role === "owner") return next();

    try {
      const db = await getDB();
      const ok = await roleHasPermission(db, user.role, permission);
      if (!ok) return res.status(403).send("Forbidden");
      return next();
    } catch (err) {
      return next(err);
    }
  };
}

module.exports = { requireAuth, requireRole, requirePermission };
