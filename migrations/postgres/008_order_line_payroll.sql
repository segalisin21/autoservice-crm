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
