ALTER TABLE users ADD COLUMN schedule_order INTEGER NOT NULL DEFAULT 0;

-- Backfill masters by name order (10, 20, 30… leaves room for inserts)
UPDATE users
SET schedule_order = (
  SELECT COUNT(*) * 10
  FROM users u2
  WHERE u2.role = 'master' AND u2.is_active = 1 AND u2.name < users.name
)
WHERE role = 'master' AND is_active = 1;
