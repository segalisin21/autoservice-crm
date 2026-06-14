-- =============================================================================
-- AUTOSERVICE CRM — дельта-миграция PostgreSQL для Railway (021)
-- =============================================================================
-- Назначение: добавить отдельное поле комментария мастера (annotation_notes).
--
-- orders.notes           — комментарий при записи (форма создания / детали заказа)
-- orders.annotation_notes — комментарий в блоке «Комментарий и фото»
--
-- Идемпотентно: ADD COLUMN IF NOT EXISTS, ON CONFLICT DO NOTHING.
--
-- Railway → Postgres → Connect → Query, или локально:
--   psql "%DATABASE_URL%" -f docs/MIGRATE_POSTGRES_RAILWAY_021.sql
--   PowerShell: psql $env:DATABASE_URL -f docs/MIGRATE_POSTGRES_RAILWAY_021.sql
--
-- Альтернатива (рекомендуется на деплое): npm run migrate
-- =============================================================================

BEGIN;

-- ---------- 021_orders_annotation_notes.sql ----------
ALTER TABLE orders ADD COLUMN IF NOT EXISTS annotation_notes TEXT;

-- ---------- migrations registry ----------
CREATE TABLE IF NOT EXISTS migrations (
  id TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS')
);

INSERT INTO migrations(id) VALUES ('021_orders_annotation_notes.sql') ON CONFLICT (id) DO NOTHING;

COMMIT;
