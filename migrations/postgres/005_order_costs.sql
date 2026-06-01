-- Cost price for materials/products lines (закупка расходника), used to compute payroll net of materials
ALTER TABLE order_lines ADD COLUMN cost_price NUMERIC(12,2) NOT NULL DEFAULT 0;
