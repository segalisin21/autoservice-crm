-- Work type from spreadsheet column "Тип работ" (Мойка / Электрика / Продажа)
ALTER TABLE orders ADD COLUMN work_type VARCHAR(50);

CREATE INDEX IF NOT EXISTS idx_orders_work_type ON orders(work_type);
