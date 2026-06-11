-- =============================================================================
-- AUTOSERVICE CRM — полная миграция SQLite (001_init.sql … 018_search_lc.sql)
-- =============================================================================
-- Назначение: развернуть схему на пустой базе SQLite (локально, тесты).
--
-- ВАЖНО:
-- 1) Выполняйте ОДИН раз на пустой файле БД (или удалите autoservice.sqlite3).
-- 2) Блок в конце создаёт таблицу migrations и помечает все файлы как применённые.
-- 3) Только схема — без бизнес-данных. Карточки каталога: npm run setup:db
-- 4) Обычно достаточно npm run migrate — этот файл для ручного sqlite3 / DBeaver.
--
-- Подключение:
--   sqlite3 data/autoservice.sqlite3 < docs/MIGRATE_SQLITE_FULL.sql
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
--   013_catalog_article.sql
--   014_catalog_description_tiers.sql
--   015_catalog_material_cost.sql
--   016_staff_absences.sql
--   017_work_type_widen.sql
--   018_search_lc.sql
-- =============================================================================

PRAGMA foreign_keys = ON;


-- ---------- 001_init.sql ----------
-- Initial schema for AUTOSERVICE CRM (SQLite + Postgres compatible subset)

-- users
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  username VARCHAR(64) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(200) NOT NULL,
  role VARCHAR(20) NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- role_permissions
CREATE TABLE IF NOT EXISTS role_permissions (
  role VARCHAR(20) NOT NULL,
  permission VARCHAR(64) NOT NULL,
  allowed INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (role, permission)
);

-- clients
CREATE TABLE IF NOT EXISTS clients (
  id INTEGER PRIMARY KEY,
  full_name VARCHAR(200) NOT NULL,
  phone_raw VARCHAR(50) NOT NULL,
  phone_normalized VARCHAR(32) NOT NULL,
  email VARCHAR(200),
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_clients_phone_norm ON clients(phone_normalized);

-- cars
CREATE TABLE IF NOT EXISTS cars (
  id INTEGER PRIMARY KEY,
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
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_cars_plate_norm ON cars(license_plate_normalized);
CREATE INDEX IF NOT EXISTS idx_cars_vin ON cars(vin);

-- reminders
CREATE TABLE IF NOT EXISTS car_reminders (
  id INTEGER PRIMARY KEY,
  car_id INTEGER NOT NULL,
  title VARCHAR(200) NOT NULL,
  due_date TEXT,
  notes TEXT,
  is_done INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (car_id) REFERENCES cars(id) ON DELETE CASCADE
);

-- catalog
CREATE TABLE IF NOT EXISTS catalog_items (
  id INTEGER PRIMARY KEY,
  type VARCHAR(20) NOT NULL,
  category VARCHAR(50) NOT NULL,
  name VARCHAR(200) NOT NULL,
  default_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  unit VARCHAR(50) NOT NULL DEFAULT '',
  is_active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_catalog_type_cat ON catalog_items(type, category);

-- settings
CREATE TABLE IF NOT EXISTS settings (
  key VARCHAR(64) PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- orders
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY,
  car_id INTEGER NOT NULL,
  opened_at TEXT NOT NULL DEFAULT (datetime('now')),
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
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),

  FOREIGN KEY (car_id) REFERENCES cars(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_opened_at ON orders(opened_at);
CREATE INDEX IF NOT EXISTS idx_orders_closed_at ON orders(closed_at);

-- order_lines
CREATE TABLE IF NOT EXISTS order_lines (
  id INTEGER PRIMARY KEY,
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

  created_at TEXT NOT NULL DEFAULT (datetime('now')),

  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (catalog_item_id) REFERENCES catalog_items(id) ON DELETE SET NULL,
  FOREIGN KEY (master_id) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_order_lines_order ON order_lines(order_id);
CREATE INDEX IF NOT EXISTS idx_order_lines_master ON order_lines(master_id);

-- payments
CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY,
  order_id INTEGER NOT NULL,
  paid_at TEXT NOT NULL DEFAULT (datetime('now')),
  amount NUMERIC(12,2) NOT NULL,
  method VARCHAR(20) NOT NULL DEFAULT 'other',
  kind VARCHAR(20) NOT NULL DEFAULT 'payment',
  note TEXT,
  created_by INTEGER,

  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_payments_order_paid_at ON payments(order_id, paid_at);

-- compensation rules
CREATE TABLE IF NOT EXISTS master_comp_rules (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL,
  mode VARCHAR(20) NOT NULL,
  value NUMERIC(12,2) NOT NULL DEFAULT 0,
  effective_from TEXT NOT NULL DEFAULT (date('now')),
  is_active INTEGER NOT NULL DEFAULT 1,

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS master_comp_overrides (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL,
  catalog_item_id INTEGER NOT NULL,
  mode VARCHAR(20) NOT NULL,
  value NUMERIC(12,2) NOT NULL DEFAULT 0,

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (catalog_item_id) REFERENCES catalog_items(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_master_comp_overrides ON master_comp_overrides(user_id, catalog_item_id);

-- payouts
CREATE TABLE IF NOT EXISTS payouts (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL,
  paid_at TEXT NOT NULL DEFAULT (datetime('now')),
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
-- Expenses (расходы): general business expenses and per-order materials (расходники)
CREATE TABLE IF NOT EXISTS expenses (
  id INTEGER PRIMARY KEY,
  expense_date TEXT NOT NULL DEFAULT (date('now')),
  category VARCHAR(20) NOT NULL DEFAULT 'other',
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  payment_method VARCHAR(20) NOT NULL DEFAULT 'cash',
  vendor VARCHAR(200),
  note TEXT,
  order_id INTEGER,
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),

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
-- Photos attached to an order (фото работ)
CREATE TABLE IF NOT EXISTS order_photos (
  id INTEGER PRIMARY KEY,
  order_id INTEGER NOT NULL,
  file_path VARCHAR(300) NOT NULL,
  original_name VARCHAR(300),
  uploaded_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),

  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_order_photos_order ON order_photos(order_id);

-- ---------- 008_order_line_payroll.sql ----------
CREATE TABLE IF NOT EXISTS order_line_payroll (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_line_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  share_percent REAL NOT NULL DEFAULT 100,
  earned_amount REAL,
  master_comp_mode TEXT,
  master_comp_value REAL,
  FOREIGN KEY (order_line_id) REFERENCES order_lines(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_order_line_payroll_line_user
  ON order_line_payroll(order_line_id, user_id);

-- ---------- 009_activity_logs.sql ----------
CREATE TABLE IF NOT EXISTS activity_logs (
  id INTEGER PRIMARY KEY,
  user_id INTEGER,
  action VARCHAR(32) NOT NULL,
  entity_type VARCHAR(32) NOT NULL,
  entity_id INTEGER,
  details TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created ON activity_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_activity_logs_entity ON activity_logs(entity_type, entity_id);

-- ---------- 010_payout_period.sql ----------
ALTER TABLE payouts ADD COLUMN period_start TEXT;
ALTER TABLE payouts ADD COLUMN period_end TEXT;

-- ---------- 011_vehicle_catalog.sql ----------
-- Vehicle reference catalog (synced from Auto.ru)
CREATE TABLE IF NOT EXISTS vehicle_marks (
  id INTEGER PRIMARY KEY,
  autoru_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  name_ru TEXT NOT NULL DEFAULT '',
  synced_at TEXT
);

CREATE TABLE IF NOT EXISTS vehicle_models (
  id INTEGER PRIMARY KEY,
  mark_id INTEGER NOT NULL REFERENCES vehicle_marks(id) ON DELETE CASCADE,
  autoru_id TEXT NOT NULL,
  name TEXT NOT NULL,
  name_ru TEXT NOT NULL DEFAULT '',
  year_from INTEGER,
  year_to INTEGER,
  synced_at TEXT,
  UNIQUE (mark_id, autoru_id)
);

CREATE INDEX IF NOT EXISTS idx_vehicle_models_mark ON vehicle_models(mark_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_marks_name ON vehicle_marks(name_ru);

CREATE TABLE IF NOT EXISTS vehicle_generations (
  id INTEGER PRIMARY KEY,
  model_id INTEGER NOT NULL REFERENCES vehicle_models(id) ON DELETE CASCADE,
  autoru_id TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  body_type TEXT NOT NULL DEFAULT '',
  year_from INTEGER,
  year_to INTEGER,
  UNIQUE (model_id, autoru_id)
);

CREATE INDEX IF NOT EXISTS idx_vehicle_generations_model ON vehicle_generations(model_id);

ALTER TABLE cars ADD COLUMN body_type TEXT;
ALTER TABLE cars ADD COLUMN vehicle_model_id INTEGER REFERENCES vehicle_models(id) ON DELETE SET NULL;

-- ---------- 013_catalog_article.sql ----------
ALTER TABLE catalog_items ADD COLUMN article TEXT;

UPDATE catalog_items
SET article = (CASE WHEN type = 'product' THEN 'P' ELSE 'W' END) || '-' || printf('%05d', id)
WHERE article IS NULL OR trim(article) = '';

CREATE UNIQUE INDEX IF NOT EXISTS ux_catalog_items_article ON catalog_items(article);

-- ---------- 014_catalog_description_tiers.sql ----------
ALTER TABLE catalog_items ADD COLUMN description TEXT;
ALTER TABLE catalog_items ADD COLUMN price_tier_2 NUMERIC(12,2);
ALTER TABLE catalog_items ADD COLUMN price_tier_3 NUMERIC(12,2);

ALTER TABLE order_lines ADD COLUMN vehicle_tier INTEGER;

-- ---------- 015_catalog_material_cost.sql ----------
ALTER TABLE catalog_items ADD COLUMN default_material_cost NUMERIC(12,2) NOT NULL DEFAULT 0;

-- ---------- 016_staff_absences.sql ----------
CREATE TABLE IF NOT EXISTS staff_absences (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  absence_date TEXT NOT NULL,
  start_time TEXT,
  end_time TEXT,
  is_full_day INTEGER NOT NULL DEFAULT 0,
  note TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_staff_absences_date ON staff_absences(absence_date, user_id);

-- ---------- 017_work_type_widen.sql ----------
-- Widen work_type for multiple comma-separated values (e.g. "Мойка, Электрика")
-- SQLite does not enforce VARCHAR length; migration documents intent for fresh installs.

-- ---------- 018_search_lc.sql ----------
-- Lowercase search keys (filled by app; SQLite LOWER() does not fold Cyrillic)

ALTER TABLE clients ADD COLUMN full_name_lc TEXT;
ALTER TABLE catalog_items ADD COLUMN name_lc TEXT;
ALTER TABLE cars ADD COLUMN make_lc TEXT;
ALTER TABLE cars ADD COLUMN model_lc TEXT;
ALTER TABLE order_lines ADD COLUMN name_lc TEXT;

CREATE INDEX IF NOT EXISTS idx_clients_full_name_lc ON clients(full_name_lc);
CREATE INDEX IF NOT EXISTS idx_catalog_name_lc ON catalog_items(name_lc);

-- ---------- migrations registry (после ручного прогона) ----------
CREATE TABLE IF NOT EXISTS migrations (
  id TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT OR IGNORE INTO migrations(id) VALUES ('001_init.sql');
INSERT OR IGNORE INTO migrations(id) VALUES ('002_work_type.sql');
INSERT OR IGNORE INTO migrations(id) VALUES ('003_garage_bay.sql');
INSERT OR IGNORE INTO migrations(id) VALUES ('004_expenses.sql');
INSERT OR IGNORE INTO migrations(id) VALUES ('005_order_costs.sql');
INSERT OR IGNORE INTO migrations(id) VALUES ('006_scheduling.sql');
INSERT OR IGNORE INTO migrations(id) VALUES ('007_order_photos.sql');
INSERT OR IGNORE INTO migrations(id) VALUES ('008_order_line_payroll.sql');
INSERT OR IGNORE INTO migrations(id) VALUES ('009_activity_logs.sql');
INSERT OR IGNORE INTO migrations(id) VALUES ('010_payout_period.sql');
INSERT OR IGNORE INTO migrations(id) VALUES ('011_vehicle_catalog.sql');
INSERT OR IGNORE INTO migrations(id) VALUES ('013_catalog_article.sql');
INSERT OR IGNORE INTO migrations(id) VALUES ('014_catalog_description_tiers.sql');
INSERT OR IGNORE INTO migrations(id) VALUES ('015_catalog_material_cost.sql');
INSERT OR IGNORE INTO migrations(id) VALUES ('016_staff_absences.sql');
INSERT OR IGNORE INTO migrations(id) VALUES ('017_work_type_widen.sql');
INSERT OR IGNORE INTO migrations(id) VALUES ('018_search_lc.sql');
