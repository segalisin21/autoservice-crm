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
