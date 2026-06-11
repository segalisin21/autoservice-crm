ALTER TABLE catalog_items ADD COLUMN IF NOT EXISTS article VARCHAR(32);

UPDATE catalog_items
SET article = (CASE WHEN type = 'product' THEN 'P' ELSE 'W' END) || '-' || lpad(id::text, 5, '0')
WHERE article IS NULL OR trim(article) = '';

ALTER TABLE catalog_items ALTER COLUMN article SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_catalog_items_article ON catalog_items(article);
