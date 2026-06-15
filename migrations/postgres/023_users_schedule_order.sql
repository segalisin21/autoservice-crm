ALTER TABLE users ADD COLUMN IF NOT EXISTS schedule_order INTEGER NOT NULL DEFAULT 0;

UPDATE users
SET schedule_order = sub.rn * 10
FROM (
  SELECT id, ROW_NUMBER() OVER (ORDER BY name) AS rn
  FROM users
  WHERE role = 'master' AND is_active = 1
) sub
WHERE users.id = sub.id;
