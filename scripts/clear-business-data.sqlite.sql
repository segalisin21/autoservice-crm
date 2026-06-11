-- SQLite: очистка заказов, клиентов, авто, каталога
-- sqlite3 data/autoservice.sqlite3 < scripts/clear-business-data.sqlite.sql

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
