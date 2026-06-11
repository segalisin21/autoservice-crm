-- =============================================================================
-- AUTOSERVICE CRM — дельта-миграция PostgreSQL для Railway (016 … 018)
-- =============================================================================
-- Назначение: обновить существующую БД на Railway, где уже применены миграции
-- до 015_catalog_material_cost.sql включительно.
--
-- Включает:
--   016 — таблица staff_absences (выходные/отсутствия мастеров)
--   017 — orders.work_type VARCHAR(100) (несколько типов работ)
--   018 — колонки *_lc для поиска без учёта регистра (кириллица)
--
-- Идемпотентно: IF NOT EXISTS / ON CONFLICT DO NOTHING.
-- После прогона npm run migrate на деплое не будет повторять эти файлы.
--
-- Railway → Postgres → Connect → Query, или локально:
--   psql "%DATABASE_URL%" -f docs/MIGRATE_POSTGRES_RAILWAY_016_018.sql
--   PowerShell: psql $env:DATABASE_URL -f docs/MIGRATE_POSTGRES_RAILWAY_016_018.sql
--
-- Альтернатива без psql: npm run migrate:railway-delta
-- =============================================================================

BEGIN;

-- ---------- 016_staff_absences.sql ----------
CREATE TABLE IF NOT EXISTS staff_absences (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  absence_date TEXT NOT NULL,
  start_time TEXT,
  end_time TEXT,
  is_full_day INTEGER NOT NULL DEFAULT 0,
  note TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS')
);

CREATE INDEX IF NOT EXISTS idx_staff_absences_date ON staff_absences(absence_date, user_id);

-- ---------- 017_work_type_widen.sql ----------
ALTER TABLE orders ALTER COLUMN work_type TYPE VARCHAR(100);

-- ---------- 018_search_lc.sql ----------
ALTER TABLE clients ADD COLUMN IF NOT EXISTS full_name_lc VARCHAR(200);
ALTER TABLE catalog_items ADD COLUMN IF NOT EXISTS name_lc VARCHAR(200);
ALTER TABLE cars ADD COLUMN IF NOT EXISTS make_lc VARCHAR(100);
ALTER TABLE cars ADD COLUMN IF NOT EXISTS model_lc VARCHAR(100);
ALTER TABLE order_lines ADD COLUMN IF NOT EXISTS name_lc VARCHAR(200);

CREATE INDEX IF NOT EXISTS idx_clients_full_name_lc ON clients(full_name_lc);
CREATE INDEX IF NOT EXISTS idx_catalog_name_lc ON catalog_items(name_lc);

-- ---------- backfill search_lc (PostgreSQL lower() для кириллицы) ----------
UPDATE clients
SET full_name_lc = lower(full_name)
WHERE full_name IS NOT NULL AND (full_name_lc IS NULL OR full_name_lc = '');

UPDATE catalog_items
SET name_lc = lower(name)
WHERE name IS NOT NULL AND (name_lc IS NULL OR name_lc = '');

UPDATE cars
SET
  make_lc = CASE WHEN make IS NOT NULL AND make <> '' THEN lower(make) ELSE make_lc END,
  model_lc = CASE WHEN model IS NOT NULL AND model <> '' THEN lower(model) ELSE model_lc END
WHERE (make IS NOT NULL AND (make_lc IS NULL OR make_lc = ''))
   OR (model IS NOT NULL AND (model_lc IS NULL OR model_lc = ''));

UPDATE order_lines
SET name_lc = lower(name)
WHERE name IS NOT NULL AND (name_lc IS NULL OR name_lc = '');

-- ---------- migrations registry ----------
CREATE TABLE IF NOT EXISTS migrations (
  id TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS')
);

INSERT INTO migrations(id) VALUES ('016_staff_absences.sql') ON CONFLICT (id) DO NOTHING;
INSERT INTO migrations(id) VALUES ('017_work_type_widen.sql') ON CONFLICT (id) DO NOTHING;
INSERT INTO migrations(id) VALUES ('018_search_lc.sql') ON CONFLICT (id) DO NOTHING;

COMMIT;
