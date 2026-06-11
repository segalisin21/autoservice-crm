-- PostgreSQL: очистка заказов, клиентов, авто, каталога
-- psql "$DATABASE_URL" -f scripts/clear-business-data.postgres.sql

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
