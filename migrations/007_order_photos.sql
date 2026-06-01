-- Photos attached to an order (фото работ)
CREATE TABLE IF NOT EXISTS order_photos (
  id INTEGER PRIMARY KEY,
  order_id INTEGER NOT NULL,
  file_path VARCHAR(300) NOT NULL,
  original_name VARCHAR(300),
  uploaded_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),

  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_order_photos_order ON order_photos(order_id);
