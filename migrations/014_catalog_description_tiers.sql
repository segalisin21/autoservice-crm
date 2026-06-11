ALTER TABLE catalog_items ADD COLUMN description TEXT;
ALTER TABLE catalog_items ADD COLUMN price_tier_2 NUMERIC(12,2);
ALTER TABLE catalog_items ADD COLUMN price_tier_3 NUMERIC(12,2);

ALTER TABLE order_lines ADD COLUMN vehicle_tier INTEGER;
