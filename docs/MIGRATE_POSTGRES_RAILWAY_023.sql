-- Railway / Postgres: порядок мастеров в расписании (миграция 023)
-- Выполнить один раз, если npm run migrate ещё не прогнал 023_users_schedule_order.sql

ALTER TABLE users ADD COLUMN IF NOT EXISTS schedule_order INTEGER NOT NULL DEFAULT 0;

UPDATE users
SET schedule_order = sub.rn * 10
FROM (
  SELECT id, ROW_NUMBER() OVER (ORDER BY name) AS rn
  FROM users
  WHERE role = 'master' AND is_active = 1
) sub
WHERE users.id = sub.id;

-- INSERT INTO migrations(id) VALUES ('023_users_schedule_order.sql') ON CONFLICT DO NOTHING;
