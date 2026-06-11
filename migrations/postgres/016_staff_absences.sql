CREATE TABLE IF NOT EXISTS staff_absences (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  absence_date TEXT NOT NULL,
  start_time TEXT,
  end_time TEXT,
  is_full_day INTEGER NOT NULL DEFAULT 0,
  note TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS')
);

CREATE INDEX IF NOT EXISTS idx_staff_absences_date ON staff_absences(absence_date, user_id);
