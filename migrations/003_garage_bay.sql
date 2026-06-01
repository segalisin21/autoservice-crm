ALTER TABLE orders ADD COLUMN bay INTEGER;
ALTER TABLE orders ADD COLUMN scheduled_date TEXT;

CREATE INDEX IF NOT EXISTS idx_orders_scheduled_bay ON orders(scheduled_date, bay);
