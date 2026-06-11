ALTER TABLE catalog_items ADD COLUMN article TEXT;

UPDATE catalog_items
SET article = (CASE WHEN type = 'product' THEN 'P' ELSE 'W' END) || '-' || printf('%05d', id)
WHERE article IS NULL OR trim(article) = '';

CREATE UNIQUE INDEX IF NOT EXISTS ux_catalog_items_article ON catalog_items(article);
