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
