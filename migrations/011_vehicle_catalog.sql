-- Vehicle reference catalog (synced from Auto.ru)
CREATE TABLE IF NOT EXISTS vehicle_marks (
  id INTEGER PRIMARY KEY,
  autoru_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  name_ru TEXT NOT NULL DEFAULT '',
  synced_at TEXT
);

CREATE TABLE IF NOT EXISTS vehicle_models (
  id INTEGER PRIMARY KEY,
  mark_id INTEGER NOT NULL REFERENCES vehicle_marks(id) ON DELETE CASCADE,
  autoru_id TEXT NOT NULL,
  name TEXT NOT NULL,
  name_ru TEXT NOT NULL DEFAULT '',
  year_from INTEGER,
  year_to INTEGER,
  synced_at TEXT,
  UNIQUE (mark_id, autoru_id)
);

CREATE INDEX IF NOT EXISTS idx_vehicle_models_mark ON vehicle_models(mark_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_marks_name ON vehicle_marks(name_ru);

CREATE TABLE IF NOT EXISTS vehicle_generations (
  id INTEGER PRIMARY KEY,
  model_id INTEGER NOT NULL REFERENCES vehicle_models(id) ON DELETE CASCADE,
  autoru_id TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  body_type TEXT NOT NULL DEFAULT '',
  year_from INTEGER,
  year_to INTEGER,
  UNIQUE (model_id, autoru_id)
);

CREATE INDEX IF NOT EXISTS idx_vehicle_generations_model ON vehicle_generations(model_id);

ALTER TABLE cars ADD COLUMN body_type TEXT;
ALTER TABLE cars ADD COLUMN vehicle_model_id INTEGER REFERENCES vehicle_models(id) ON DELETE SET NULL;
