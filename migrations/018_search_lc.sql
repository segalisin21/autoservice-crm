-- Lowercase search keys (filled by app; SQLite LOWER() does not fold Cyrillic)

ALTER TABLE clients ADD COLUMN full_name_lc TEXT;
ALTER TABLE catalog_items ADD COLUMN name_lc TEXT;
ALTER TABLE cars ADD COLUMN make_lc TEXT;
ALTER TABLE cars ADD COLUMN model_lc TEXT;
ALTER TABLE order_lines ADD COLUMN name_lc TEXT;

CREATE INDEX IF NOT EXISTS idx_clients_full_name_lc ON clients(full_name_lc);
CREATE INDEX IF NOT EXISTS idx_catalog_name_lc ON catalog_items(name_lc);
