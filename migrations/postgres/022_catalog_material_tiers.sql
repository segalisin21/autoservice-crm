ALTER TABLE catalog_items ADD COLUMN IF NOT EXISTS material_cost_tier_2 NUMERIC(12,2);
ALTER TABLE catalog_items ADD COLUMN IF NOT EXISTS material_cost_tier_3 NUMERIC(12,2);
