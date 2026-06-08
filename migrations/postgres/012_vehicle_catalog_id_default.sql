-- Repair vehicle catalog id columns if table was created without SERIAL/default
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_attrdef ad
    JOIN pg_attribute a ON ad.adrelid = a.attrelid AND ad.adnum = a.attnum
    JOIN pg_class c ON c.oid = a.attrelid
    WHERE c.relname = 'vehicle_marks' AND a.attname = 'id'
  ) THEN
    CREATE SEQUENCE IF NOT EXISTS vehicle_marks_id_seq;
    PERFORM setval('vehicle_marks_id_seq', GREATEST(COALESCE((SELECT MAX(id) FROM vehicle_marks), 0), 1));
    ALTER TABLE vehicle_marks ALTER COLUMN id SET DEFAULT nextval('vehicle_marks_id_seq');
    ALTER SEQUENCE vehicle_marks_id_seq OWNED BY vehicle_marks.id;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_attrdef ad
    JOIN pg_attribute a ON ad.adrelid = a.attrelid AND ad.adnum = a.attnum
    JOIN pg_class c ON c.oid = a.attrelid
    WHERE c.relname = 'vehicle_models' AND a.attname = 'id'
  ) THEN
    CREATE SEQUENCE IF NOT EXISTS vehicle_models_id_seq;
    PERFORM setval('vehicle_models_id_seq', GREATEST(COALESCE((SELECT MAX(id) FROM vehicle_models), 0), 1));
    ALTER TABLE vehicle_models ALTER COLUMN id SET DEFAULT nextval('vehicle_models_id_seq');
    ALTER SEQUENCE vehicle_models_id_seq OWNED BY vehicle_models.id;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_attrdef ad
    JOIN pg_attribute a ON ad.adrelid = a.attrelid AND ad.adnum = a.attnum
    JOIN pg_class c ON c.oid = a.attrelid
    WHERE c.relname = 'vehicle_generations' AND a.attname = 'id'
  ) THEN
    CREATE SEQUENCE IF NOT EXISTS vehicle_generations_id_seq;
    PERFORM setval('vehicle_generations_id_seq', GREATEST(COALESCE((SELECT MAX(id) FROM vehicle_generations), 0), 1));
    ALTER TABLE vehicle_generations ALTER COLUMN id SET DEFAULT nextval('vehicle_generations_id_seq');
    ALTER SEQUENCE vehicle_generations_id_seq OWNED BY vehicle_generations.id;
  END IF;
END $$;
