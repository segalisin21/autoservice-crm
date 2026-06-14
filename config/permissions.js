const PERMISSIONS = [
  "dashboard:view",
  "clients:view",
  "clients:mutate",
  "cars:view",
  "cars:mutate",
  "orders:view",
  "orders:mutate",
  "orders:annotate",
  "catalog:view",
  "catalog:manage",
  "payments:view",
  "payments:mutate",
  "payroll:view",
  "payroll:mutate",
  "expenses:view",
  "expenses:mutate",
  "admin:users",
  "admin:access",
  "admin:settings",
  "admin:logs",
  "admin:reports"
];

/** role -> Set(permission) */
const DEFAULT_MATRIX = {
  owner: new Set(PERMISSIONS),
  admin: new Set([
    "dashboard:view",
    "clients:view",
    "clients:mutate",
    "cars:view",
    "cars:mutate",
    "orders:view",
    "orders:mutate",
    "catalog:view",
    "catalog:manage",
    "payments:view",
    "payroll:view",
    "payroll:mutate",
    "expenses:view",
    "expenses:mutate",
    "admin:reports"
  ]),
  master: new Set(["dashboard:view", "orders:view", "orders:annotate", "payroll:view"]),
  manager: new Set([
    "dashboard:view",
    "clients:view",
    "clients:mutate",
    "cars:view",
    "cars:mutate",
    "orders:view",
    "orders:mutate",
    "catalog:view",
    "payments:view",
    "payments:mutate"
  ])
};

async function seedDefaultPermissions(db) {
  for (const role of Object.keys(DEFAULT_MATRIX)) {
    for (const permission of PERMISSIONS) {
      const allowed = DEFAULT_MATRIX[role].has(permission) ? 1 : 0;
      await db.query(
        `
        INSERT INTO role_permissions(role, permission, allowed)
        VALUES (?, ?, ?)
        ON CONFLICT(role, permission) DO UPDATE SET allowed = excluded.allowed
      `,
        [role, permission, allowed]
      );
    }
  }
}

const _cache = new Map();

async function loadRolePermissions(db, role) {
  if (role === "owner") return DEFAULT_MATRIX.owner;
  if (_cache.has(role)) return _cache.get(role);

  const rows = await db.query(
    "SELECT permission, allowed FROM role_permissions WHERE role = ? AND allowed = 1",
    [role]
  );
  const set = new Set(rows.map((r) => r.permission));
  _cache.set(role, set);
  return set;
}

function clearPermissionCache() {
  _cache.clear();
}

async function roleHasPermission(db, role, permission) {
  if (role === "owner") return true;
  const perms = await loadRolePermissions(db, role);
  return perms.has(permission);
}

module.exports = {
  PERMISSIONS,
  DEFAULT_MATRIX,
  seedDefaultPermissions,
  loadRolePermissions,
  roleHasPermission,
  clearPermissionCache
};
