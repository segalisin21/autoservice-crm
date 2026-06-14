const { getDB } = require("../config/database");
const { loadRolePermissions, canViewOrderMoney } = require("../config/permissions");

const ROLE_LABELS = {
  owner: "Владелец",
  admin: "Администратор",
  manager: "Менеджер",
  master: "Мастер"
};

async function loadUserPermissions(req, res, next) {
  const user = req.session?.user;
  if (!user) return next();

  try {
    const db = await getDB();
    const permissions = await loadRolePermissions(db, user.role);
    res.locals.permissions = permissions;
    res.locals.can = (permission) => user.role === "owner" || permissions.has(permission);
    res.locals.roleLabel = ROLE_LABELS[user.role] || user.role;
    res.locals.showMoney = canViewOrderMoney(user.role);
    return next();
  } catch (err) {
    return next(err);
  }
}

module.exports = { loadUserPermissions, ROLE_LABELS };
