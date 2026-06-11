-- =============================================================================
-- AUTOSERVICE CRM — полная миграция PostgreSQL (001_init.sql … 018_search_lc.sql)
-- =============================================================================
-- Назначение: развернуть схему на пустой БД (Railway, VPS, локальный Postgres).
--
-- ВАЖНО:
-- 1) Выполняйте ОДИН раз на пустой базе (или после DROP SCHEMA public CASCADE; CREATE SCHEMA public;).
-- 2) Блок в конце создаёт таблицу migrations и помечает все файлы как применённые —
--    иначе при старте приложение попытается выполнить те же ALTER повторно.
-- 3) Только схема — без клиентов, заказов и прочих бизнес-данных.
--    Старый учёт из «Учет - Лист1 (1).csv» сюда НЕ входит.
--    После схемы — карточки каталога из прайса: npm run setup:db
--    (или только прайс: npm run import:price-sheet)
-- 4) На Railway обычно хватает переменной DATABASE_URL: applyMigrations() при boot.
--    Этот файл — для ручного psql, DBeaver, дампа схемы, аварийного восстановления.
--
-- Подключение:
--   psql "%DATABASE_URL%" -f docs/MIGRATE_POSTGRES_FULL.sql
--   (Windows cmd) или psql $env:DATABASE_URL -f docs/MIGRATE_POSTGRES_FULL.sql (PowerShell)
--
-- Порядок:
--   001_init.sql
--   002_work_type.sql
--   003_garage_bay.sql
--   004_expenses.sql
--   005_order_costs.sql
--   006_scheduling.sql
--   007_order_photos.sql
--   008_order_line_payroll.sql
--   009_activity_logs.sql
--   010_payout_period.sql
--   011_vehicle_catalog.sql
--   012_vehicle_catalog_id_default.sql
--   013_catalog_article.sql
--   014_catalog_description_tiers.sql
--   015_catalog_material_cost.sql
--   016_staff_absences.sql
--   017_work_type_widen.sql
--   018_search_lc.sql
-- =============================================================================


-- ---------- 001_init.sql ----------
-- Initial schema for AUTOSERVICE CRM (PostgreSQL)

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(64) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(200) NOT NULL,
  role VARCHAR(20) NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS'),
  updated_at TEXT NOT NULL DEFAULT to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS')
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role VARCHAR(20) NOT NULL,
  permission VARCHAR(64) NOT NULL,
  allowed INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (role, permission)
);

CREATE TABLE IF NOT EXISTS clients (
  id SERIAL PRIMARY KEY,
  full_name VARCHAR(200) NOT NULL,
  phone_raw VARCHAR(50) NOT NULL,
  phone_normalized VARCHAR(32) NOT NULL,
  email VARCHAR(200),
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS'),
  updated_at TEXT NOT NULL DEFAULT to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS')
);
CREATE INDEX IF NOT EXISTS idx_clients_phone_norm ON clients(phone_normalized);

CREATE TABLE IF NOT EXISTS cars (
  id SERIAL PRIMARY KEY,
  client_id INTEGER NOT NULL,
  make VARCHAR(100),
  model VARCHAR(100),
  vin VARCHAR(64),
  license_plate_raw VARCHAR(50),
  license_plate_normalized VARCHAR(32),
  year INTEGER,
  color VARCHAR(50),
  mileage INTEGER,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS'),
  updated_at TEXT NOT NULL DEFAULT to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS'),
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_cars_plate_norm ON cars(license_plate_normalized);
CREATE INDEX IF NOT EXISTS idx_cars_vin ON cars(vin);

CREATE TABLE IF NOT EXISTS car_reminders (
  id SERIAL PRIMARY KEY,
  car_id INTEGER NOT NULL,
  title VARCHAR(200) NOT NULL,
  due_date TEXT,
  notes TEXT,
  is_done INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS'),
  FOREIGN KEY (car_id) REFERENCES cars(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS catalog_items (
  id SERIAL PRIMARY KEY,
  type VARCHAR(20) NOT NULL,
  category VARCHAR(50) NOT NULL,
  name VARCHAR(200) NOT NULL,
  default_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  unit VARCHAR(50) NOT NULL DEFAULT '',
  is_active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS'),
  updated_at TEXT NOT NULL DEFAULT to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS')
);
CREATE INDEX IF NOT EXISTS idx_catalog_type_cat ON catalog_items(type, category);

CREATE TABLE IF NOT EXISTS settings (
  key VARCHAR(64) PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS')
);

CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  car_id INTEGER NOT NULL,
  opened_at TEXT NOT NULL DEFAULT to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS'),
  closed_at TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'scheduled',
  notes TEXT,

  discount_type VARCHAR(20) NOT NULL DEFAULT 'none',
  discount_value NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount_scope VARCHAR(20) NOT NULL DEFAULT 'order_total',
  discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0,

  tax_enabled INTEGER NOT NULL DEFAULT 0,
  tax_mode VARCHAR(20),
  tax_rate NUMERIC(6,2) NOT NULL DEFAULT 0,
  prices_include_tax INTEGER NOT NULL DEFAULT 0,
  tax_amount NUMERIC(12,2) NOT NULL DEFAULT 0,

  subtotal_works NUMERIC(12,2) NOT NULL DEFAULT 0,
  subtotal_products NUMERIC(12,2) NOT NULL DEFAULT 0,
  subtotal_before_tax NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_price NUMERIC(12,2) NOT NULL DEFAULT 0,

  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS'),
  updated_at TEXT NOT NULL DEFAULT to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS'),

  FOREIGN KEY (car_id) REFERENCES cars(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_opened_at ON orders(opened_at);
CREATE INDEX IF NOT EXISTS idx_orders_closed_at ON orders(closed_at);

CREATE TABLE IF NOT EXISTS order_lines (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL,
  line_type VARCHAR(20) NOT NULL,
  catalog_item_id INTEGER,
  name VARCHAR(200) NOT NULL,
  quantity NUMERIC(12,2) NOT NULL DEFAULT 1,
  unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes TEXT,

  master_id INTEGER,
  work_status VARCHAR(20),
  labor_minutes INTEGER,
  master_comp_mode VARCHAR(20),
  master_comp_value NUMERIC(12,2),
  master_earned_amount NUMERIC(12,2),

  created_at TEXT NOT NULL DEFAULT to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS'),

  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (catalog_item_id) REFERENCES catalog_items(id) ON DELETE SET NULL,
  FOREIGN KEY (master_id) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_order_lines_order ON order_lines(order_id);
CREATE INDEX IF NOT EXISTS idx_order_lines_master ON order_lines(master_id);

CREATE TABLE IF NOT EXISTS payments (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL,
  paid_at TEXT NOT NULL DEFAULT to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS'),
  amount NUMERIC(12,2) NOT NULL,
  method VARCHAR(20) NOT NULL DEFAULT 'other',
  kind VARCHAR(20) NOT NULL DEFAULT 'payment',
  note TEXT,
  created_by INTEGER,

  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_payments_order_paid_at ON payments(order_id, paid_at);

CREATE TABLE IF NOT EXISTS master_comp_rules (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  mode VARCHAR(20) NOT NULL,
  value NUMERIC(12,2) NOT NULL DEFAULT 0,
  effective_from TEXT NOT NULL DEFAULT (CURRENT_DATE::text),
  is_active INTEGER NOT NULL DEFAULT 1,

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS master_comp_overrides (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  catalog_item_id INTEGER NOT NULL,
  mode VARCHAR(20) NOT NULL,
  value NUMERIC(12,2) NOT NULL DEFAULT 0,

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (catalog_item_id) REFERENCES catalog_items(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_master_comp_overrides ON master_comp_overrides(user_id, catalog_item_id);

CREATE TABLE IF NOT EXISTS payouts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  paid_at TEXT NOT NULL DEFAULT to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS'),
  amount NUMERIC(12,2) NOT NULL,
  method VARCHAR(20) NOT NULL DEFAULT 'other',
  note TEXT,
  created_by INTEGER,

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_payouts_user_paid_at ON payouts(user_id, paid_at);

-- ---------- 002_work_type.sql ----------
-- Work type from spreadsheet column "Тип работ" (Мойка / Электрика / Продажа)
ALTER TABLE orders ADD COLUMN work_type VARCHAR(50);

CREATE INDEX IF NOT EXISTS idx_orders_work_type ON orders(work_type);

-- ---------- 003_garage_bay.sql ----------
ALTER TABLE orders ADD COLUMN bay INTEGER;
ALTER TABLE orders ADD COLUMN scheduled_date TEXT;

CREATE INDEX IF NOT EXISTS idx_orders_scheduled_bay ON orders(scheduled_date, bay);

-- ---------- 004_expenses.sql ----------
CREATE TABLE IF NOT EXISTS expenses (
  id SERIAL PRIMARY KEY,
  expense_date TEXT NOT NULL DEFAULT (CURRENT_DATE::text),
  category VARCHAR(20) NOT NULL DEFAULT 'other',
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  payment_method VARCHAR(20) NOT NULL DEFAULT 'cash',
  vendor VARCHAR(200),
  note TEXT,
  order_id INTEGER,
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS'),

  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_expenses_order ON expenses(order_id);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);

-- ---------- 005_order_costs.sql ----------
-- Cost price for materials/products lines (закупка расходника), used to compute payroll net of materials
ALTER TABLE order_lines ADD COLUMN cost_price NUMERIC(12,2) NOT NULL DEFAULT 0;

-- ---------- 006_scheduling.sql ----------
-- Per-employee hourly scheduling on orders
ALTER TABLE orders ADD COLUMN assigned_user_id INTEGER;
ALTER TABLE orders ADD COLUMN start_time TEXT;
ALTER TABLE orders ADD COLUMN end_time TEXT;

CREATE INDEX IF NOT EXISTS idx_orders_assigned ON orders(scheduled_date, assigned_user_id);

-- ---------- 007_order_photos.sql ----------
CREATE TABLE IF NOT EXISTS order_photos (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL,
  file_path VARCHAR(300) NOT NULL,
  original_name VARCHAR(300),
  uploaded_by INTEGER,
  created_at TEXT NOT NULL DEFAULT to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS'),

  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_order_photos_order ON order_photos(order_id);

-- ---------- 008_order_line_payroll.sql ----------
CREATE TABLE IF NOT EXISTS order_line_payroll (
  id SERIAL PRIMARY KEY,
  order_line_id INTEGER NOT NULL REFERENCES order_lines(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  share_percent DOUBLE PRECISION NOT NULL DEFAULT 100,
  earned_amount DOUBLE PRECISION,
  master_comp_mode TEXT,
  master_comp_value DOUBLE PRECISION
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_order_line_payroll_line_user
  ON order_line_payroll(order_line_id, user_id);

-- ---------- 009_activity_logs.sql ----------
CREATE TABLE IF NOT EXISTS activity_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(32) NOT NULL,
  entity_type VARCHAR(32) NOT NULL,
  entity_id INTEGER,
  details TEXT,
  created_at TEXT NOT NULL DEFAULT to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS')
);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created ON activity_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_activity_logs_entity ON activity_logs(entity_type, entity_id);

-- ---------- 010_payout_period.sql ----------
ALTER TABLE payouts ADD COLUMN IF NOT EXISTS period_start TEXT;
ALTER TABLE payouts ADD COLUMN IF NOT EXISTS period_end TEXT;

-- ---------- 011_vehicle_catalog.sql ----------
CREATE TABLE IF NOT EXISTS vehicle_marks (
  id SERIAL PRIMARY KEY,
  autoru_id VARCHAR(100) NOT NULL UNIQUE,
  name VARCHAR(200) NOT NULL,
  name_ru VARCHAR(200) NOT NULL DEFAULT '',
  synced_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS vehicle_models (
  id SERIAL PRIMARY KEY,
  mark_id INTEGER NOT NULL REFERENCES vehicle_marks(id) ON DELETE CASCADE,
  autoru_id VARCHAR(100) NOT NULL,
  name VARCHAR(200) NOT NULL,
  name_ru VARCHAR(200) NOT NULL DEFAULT '',
  year_from INTEGER,
  year_to INTEGER,
  synced_at TIMESTAMPTZ,
  UNIQUE (mark_id, autoru_id)
);

CREATE INDEX IF NOT EXISTS idx_vehicle_models_mark ON vehicle_models(mark_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_marks_name ON vehicle_marks(name_ru);

CREATE TABLE IF NOT EXISTS vehicle_generations (
  id SERIAL PRIMARY KEY,
  model_id INTEGER NOT NULL REFERENCES vehicle_models(id) ON DELETE CASCADE,
  autoru_id VARCHAR(100) NOT NULL,
  name VARCHAR(200) NOT NULL DEFAULT '',
  body_type VARCHAR(100) NOT NULL DEFAULT '',
  year_from INTEGER,
  year_to INTEGER,
  UNIQUE (model_id, autoru_id)
);

CREATE INDEX IF NOT EXISTS idx_vehicle_generations_model ON vehicle_generations(model_id);

ALTER TABLE cars ADD COLUMN IF NOT EXISTS body_type VARCHAR(100);
ALTER TABLE cars ADD COLUMN IF NOT EXISTS vehicle_model_id INTEGER REFERENCES vehicle_models(id) ON DELETE SET NULL;

-- ---------- 012_vehicle_catalog_id_default.sql ----------
-- Repair vehicle catalog id columns if table was created without SERIAL/default
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_attrdef ad
    JOIN pg_attribute a ON ad.adrelid = a.attrelid AND ad.adnum = a.attnum
    JOIN pg_class c ON c.oid = a.attrelid
    WHERE c.relname = 'vehicle_marks' AND a.attname = 'id'
  ) THEN
    CREATE SEQUENCE IF NOT EXISTS vehicle_marks_id_seq;
    PERFORM setval('vehicle_marks_id_seq', GREATEST(COALESCE((SELECT MAX(id) FROM vehicle_marks), 0), 1));
    ALTER TABLE vehicle_marks ALTER COLUMN id SET DEFAULT nextval('vehicle_marks_id_seq');
    ALTER SEQUENCE vehicle_marks_id_seq OWNED BY vehicle_marks.id;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_attrdef ad
    JOIN pg_attribute a ON ad.adrelid = a.attrelid AND ad.adnum = a.attnum
    JOIN pg_class c ON c.oid = a.attrelid
    WHERE c.relname = 'vehicle_models' AND a.attname = 'id'
  ) THEN
    CREATE SEQUENCE IF NOT EXISTS vehicle_models_id_seq;
    PERFORM setval('vehicle_models_id_seq', GREATEST(COALESCE((SELECT MAX(id) FROM vehicle_models), 0), 1));
    ALTER TABLE vehicle_models ALTER COLUMN id SET DEFAULT nextval('vehicle_models_id_seq');
    ALTER SEQUENCE vehicle_models_id_seq OWNED BY vehicle_models.id;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_attrdef ad
    JOIN pg_attribute a ON ad.adrelid = a.attrelid AND ad.adnum = a.attnum
    JOIN pg_class c ON c.oid = a.attrelid
    WHERE c.relname = 'vehicle_generations' AND a.attname = 'id'
  ) THEN
    CREATE SEQUENCE IF NOT EXISTS vehicle_generations_id_seq;
    PERFORM setval('vehicle_generations_id_seq', GREATEST(COALESCE((SELECT MAX(id) FROM vehicle_generations), 0), 1));
    ALTER TABLE vehicle_generations ALTER COLUMN id SET DEFAULT nextval('vehicle_generations_id_seq');
    ALTER SEQUENCE vehicle_generations_id_seq OWNED BY vehicle_generations.id;
  END IF;
END $$;

-- ---------- 013_catalog_article.sql ----------
ALTER TABLE catalog_items ADD COLUMN IF NOT EXISTS article VARCHAR(32);

UPDATE catalog_items
SET article = (CASE WHEN type = 'product' THEN 'P' ELSE 'W' END) || '-' || lpad(id::text, 5, '0')
WHERE article IS NULL OR trim(article) = '';

ALTER TABLE catalog_items ALTER COLUMN article SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_catalog_items_article ON catalog_items(article);

-- ---------- 014_catalog_description_tiers.sql ----------
ALTER TABLE catalog_items ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE catalog_items ADD COLUMN IF NOT EXISTS price_tier_2 NUMERIC(12,2);
ALTER TABLE catalog_items ADD COLUMN IF NOT EXISTS price_tier_3 NUMERIC(12,2);

ALTER TABLE order_lines ADD COLUMN IF NOT EXISTS vehicle_tier INTEGER;

-- ---------- 015_catalog_material_cost.sql ----------
ALTER TABLE catalog_items ADD COLUMN IF NOT EXISTS default_material_cost NUMERIC(12,2) NOT NULL DEFAULT 0;

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

-- ---------- migrations registry (после ручного прогона) ----------
CREATE TABLE IF NOT EXISTS migrations (
  id TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS')
);
INSERT INTO migrations(id) VALUES ('001_init.sql') ON CONFLICT (id) DO NOTHING;
INSERT INTO migrations(id) VALUES ('002_work_type.sql') ON CONFLICT (id) DO NOTHING;
INSERT INTO migrations(id) VALUES ('003_garage_bay.sql') ON CONFLICT (id) DO NOTHING;
INSERT INTO migrations(id) VALUES ('004_expenses.sql') ON CONFLICT (id) DO NOTHING;
INSERT INTO migrations(id) VALUES ('005_order_costs.sql') ON CONFLICT (id) DO NOTHING;
INSERT INTO migrations(id) VALUES ('006_scheduling.sql') ON CONFLICT (id) DO NOTHING;
INSERT INTO migrations(id) VALUES ('007_order_photos.sql') ON CONFLICT (id) DO NOTHING;
INSERT INTO migrations(id) VALUES ('008_order_line_payroll.sql') ON CONFLICT (id) DO NOTHING;
INSERT INTO migrations(id) VALUES ('009_activity_logs.sql') ON CONFLICT (id) DO NOTHING;
INSERT INTO migrations(id) VALUES ('010_payout_period.sql') ON CONFLICT (id) DO NOTHING;
INSERT INTO migrations(id) VALUES ('011_vehicle_catalog.sql') ON CONFLICT (id) DO NOTHING;
INSERT INTO migrations(id) VALUES ('012_vehicle_catalog_id_default.sql') ON CONFLICT (id) DO NOTHING;
INSERT INTO migrations(id) VALUES ('013_catalog_article.sql') ON CONFLICT (id) DO NOTHING;
INSERT INTO migrations(id) VALUES ('014_catalog_description_tiers.sql') ON CONFLICT (id) DO NOTHING;
INSERT INTO migrations(id) VALUES ('015_catalog_material_cost.sql') ON CONFLICT (id) DO NOTHING;
INSERT INTO migrations(id) VALUES ('016_staff_absences.sql') ON CONFLICT (id) DO NOTHING;
INSERT INTO migrations(id) VALUES ('017_work_type_widen.sql') ON CONFLICT (id) DO NOTHING;
INSERT INTO migrations(id) VALUES ('018_search_lc.sql') ON CONFLICT (id) DO NOTHING;
