-- Railway / Postgres: дата окончания для многодневных заказов
-- Выполнить один раз, если npm run migrate ещё не прогнал 025_scheduled_end_date.sql

ALTER TABLE orders ADD COLUMN IF NOT EXISTS scheduled_end_date TEXT;

-- INSERT INTO migrations(id) VALUES ('025_scheduled_end_date.sql') ON CONFLICT DO NOTHING;
