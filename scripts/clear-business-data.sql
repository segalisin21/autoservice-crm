-- =============================================================================
-- Очистка операционных данных CRM (перед повторным заполнением)
--
-- УДАЛЯЕТ:
--   заказы (строки, payroll, оплаты, фото)
--   клиентов и автомобили (напоминания)
--   каталог услуг/товаров (и персональные ставки master_comp_overrides)
--   расходы и выплаты ЗП (история финансов)
--
-- НЕ ТРОГАЕТ:
--   users, role_permissions, settings
--   справочник марок/моделей авто (vehicle_marks, vehicle_models, …)
--   master_comp_rules (общие правила ЗП по сотрудникам)
--   migrations
--
-- Файлы фото заказов на диске (uploads/) этим скриптом не удаляются.
-- =============================================================================


-- =============================================================================
-- SQLite  (локально: data/autoservice.sqlite3)
-- Выполнение:
--   sqlite3 data/autoservice.sqlite3 < scripts/clear-business-data.sql
-- или в DB Browser / DBeaver — только блок ниже до «КОНЕЦ SQLite»
-- =============================================================================

BEGIN IMMEDIATE;

PRAGMA foreign_keys = ON;

DELETE FROM order_line_payroll;
DELETE FROM order_lines;
DELETE FROM order_photos;
DELETE FROM payments;
DELETE FROM orders;
DELETE FROM expenses;
DELETE FROM payouts;
DELETE FROM car_reminders;
DELETE FROM cars;
DELETE FROM clients;
DELETE FROM master_comp_overrides;
DELETE FROM catalog_items;

-- Сброс счётчиков id (чтобы новые записи шли с 1)
DELETE FROM sqlite_sequence WHERE name IN (
  'clients',
  'cars',
  'car_reminders',
  'catalog_items',
  'orders',
  'order_lines',
  'order_line_payroll',
  'order_photos',
  'payments',
  'expenses',
  'payouts',
  'master_comp_overrides'
);

COMMIT;

-- КОНЕЦ SQLite


-- =============================================================================
-- PostgreSQL  (прод / DATABASE_URL)
-- Выполнение:
--   psql "$DATABASE_URL" -f scripts/clear-business-data.sql
-- В psql выполняйте ТОЛЬКО блок ниже (без SQLite выше).
-- =============================================================================

/*
BEGIN;

TRUNCATE TABLE
  order_line_payroll,
  order_lines,
  order_photos,
  payments,
  orders,
  expenses,
  payouts,
  car_reminders,
  cars,
  clients,
  master_comp_overrides,
  catalog_items
RESTART IDENTITY CASCADE;

COMMIT;
*/

-- КОНЕЦ PostgreSQL
