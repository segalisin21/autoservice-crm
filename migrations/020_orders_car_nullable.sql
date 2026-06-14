-- Allow orders without a linked car (filled in at intake)
PRAGMA foreign_keys=OFF;

CREATE TABLE orders_new (
  id INTEGER PRIMARY KEY,
  car_id INTEGER,
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

  work_type VARCHAR(100),
  bay INTEGER,
  scheduled_date TEXT,
  assigned_user_id INTEGER,
  start_time TEXT,
  end_time TEXT,

  FOREIGN KEY (car_id) REFERENCES cars(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

INSERT INTO orders_new SELECT * FROM orders;

DROP TABLE orders;
ALTER TABLE orders_new RENAME TO orders;

CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_opened_at ON orders(opened_at);
CREATE INDEX IF NOT EXISTS idx_orders_closed_at ON orders(closed_at);
CREATE INDEX IF NOT EXISTS idx_orders_assigned ON orders(scheduled_date, assigned_user_id);

PRAGMA foreign_keys=ON;
