-- Per-employee hourly scheduling on orders
ALTER TABLE orders ADD COLUMN assigned_user_id INTEGER;
ALTER TABLE orders ADD COLUMN start_time TEXT;
ALTER TABLE orders ADD COLUMN end_time TEXT;

CREATE INDEX IF NOT EXISTS idx_orders_assigned ON orders(scheduled_date, assigned_user_id);
