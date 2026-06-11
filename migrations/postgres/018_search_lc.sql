ALTER TABLE clients ADD COLUMN IF NOT EXISTS full_name_lc VARCHAR(200);
ALTER TABLE catalog_items ADD COLUMN IF NOT EXISTS name_lc VARCHAR(200);
ALTER TABLE cars ADD COLUMN IF NOT EXISTS make_lc VARCHAR(100);
ALTER TABLE cars ADD COLUMN IF NOT EXISTS model_lc VARCHAR(100);
ALTER TABLE order_lines ADD COLUMN IF NOT EXISTS name_lc VARCHAR(200);

CREATE INDEX IF NOT EXISTS idx_clients_full_name_lc ON clients(full_name_lc);
CREATE INDEX IF NOT EXISTS idx_catalog_name_lc ON catalog_items(name_lc);
