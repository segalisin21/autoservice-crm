ALTER TABLE users ADD COLUMN IF NOT EXISTS show_in_schedule INTEGER NOT NULL DEFAULT 0;

UPDATE users SET show_in_schedule = 1 WHERE role = 'master';
UPDATE users SET show_in_schedule = 1 WHERE username = 'vitalik';

UPDATE users
SET schedule_order = (
  SELECT COALESCE(MAX(schedule_order), 0) + 10 FROM users WHERE show_in_schedule = 1 AND username != 'vitalik'
)
WHERE username = 'vitalik' AND show_in_schedule = 1;
