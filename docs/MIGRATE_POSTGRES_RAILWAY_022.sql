-- Railway / Postgres: расходники по категориям авто в каталоге (миграция 022)
-- Выполнить один раз, если npm run migrate ещё не прогнал 022_catalog_material_tiers.sql

ALTER TABLE catalog_items ADD COLUMN IF NOT EXISTS material_cost_tier_2 NUMERIC(12,2);
ALTER TABLE catalog_items ADD COLUMN IF NOT EXISTS material_cost_tier_3 NUMERIC(12,2);

-- Пометить миграцию (если таблица migrations есть):
-- INSERT INTO migrations(id) VALUES ('022_catalog_material_tiers.sql') ON CONFLICT DO NOTHING;
