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
