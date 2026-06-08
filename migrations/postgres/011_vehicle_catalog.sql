CREATE TABLE IF NOT EXISTS vehicle_marks (
  id SERIAL PRIMARY KEY,
  autoru_id VARCHAR(100) NOT NULL UNIQUE,
  name VARCHAR(200) NOT NULL,
  name_ru VARCHAR(200) NOT NULL DEFAULT '',
  synced_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS vehicle_models (
  id SERIAL PRIMARY KEY,
  mark_id INTEGER NOT NULL REFERENCES vehicle_marks(id) ON DELETE CASCADE,
  autoru_id VARCHAR(100) NOT NULL,
  name VARCHAR(200) NOT NULL,
  name_ru VARCHAR(200) NOT NULL DEFAULT '',
  year_from INTEGER,
  year_to INTEGER,
  synced_at TIMESTAMPTZ,
  UNIQUE (mark_id, autoru_id)
);

CREATE INDEX IF NOT EXISTS idx_vehicle_models_mark ON vehicle_models(mark_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_marks_name ON vehicle_marks(name_ru);

CREATE TABLE IF NOT EXISTS vehicle_generations (
  id SERIAL PRIMARY KEY,
  model_id INTEGER NOT NULL REFERENCES vehicle_models(id) ON DELETE CASCADE,
  autoru_id VARCHAR(100) NOT NULL,
  name VARCHAR(200) NOT NULL DEFAULT '',
  body_type VARCHAR(100) NOT NULL DEFAULT '',
  year_from INTEGER,
  year_to INTEGER,
  UNIQUE (model_id, autoru_id)
);

CREATE INDEX IF NOT EXISTS idx_vehicle_generations_model ON vehicle_generations(model_id);

ALTER TABLE cars ADD COLUMN IF NOT EXISTS body_type VARCHAR(100);
ALTER TABLE cars ADD COLUMN IF NOT EXISTS vehicle_model_id INTEGER REFERENCES vehicle_models(id) ON DELETE SET NULL;
