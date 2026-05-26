-- Idempotent catalog seed (mirrors supabase/seed.sql) so migrations alone populate programs after db:push.

INSERT INTO programs (slug, title, description, weeks, level) VALUES
  ('bodyweight-foundations-4w', 'Bodyweight Foundations', '4 weeks, 3 sessions/week. Build squats, push-ups, rows and plank holds.', 4, 'beginner'),
  ('5k-ramp-6w',                '5K Ramp Up',             '6 weeks of progressive run/walk intervals, ending with a continuous 5K.', 6, 'beginner'),
  ('fullbody-db-8w',            'Full-body Dumbbell',     '8 weeks, 3 full-body dumbbell sessions per week with progressive overload.', 8, 'intermediate')
ON CONFLICT (slug) DO NOTHING;

WITH p AS (SELECT id FROM programs WHERE slug = 'bodyweight-foundations-4w')
INSERT INTO program_days (program_id, day_index, title, notes)
SELECT p.id, d.idx, d.title, d.notes FROM p,
  (VALUES
    (1, 'Day 1 — Full-body A', 'Tempo-focused. 3 sets per block, 60s rest.'),
    (2, 'Day 2 — Full-body B', 'Add 1 rep per block vs last week if form holds.'),
    (3, 'Day 3 — Mobility',    'Short, breathing-led. No failure sets today.')
  ) AS d(idx, title, notes)
ON CONFLICT (program_id, day_index) DO NOTHING;

WITH d AS (
  SELECT pd.id FROM program_days pd
  JOIN programs p ON p.id = pd.program_id
  WHERE p.slug = 'bodyweight-foundations-4w' AND pd.day_index = 1
),
b AS (
  SELECT * FROM (VALUES
    (1, 1, 3, 10, 60),
    (2, 2, 2, 8, 60),
    (3, 3, 4, 30, 45),
    (4, 4, 5, 10, 60)
  ) AS t(ord, exercise_id, sets, reps, rest_sec)
)
INSERT INTO program_day_blocks (program_day_id, order_index, exercise_id, sets, reps, rest_sec)
SELECT d.id, b.ord, b.exercise_id, b.sets, b.reps, b.rest_sec
FROM d CROSS JOIN b
WHERE NOT EXISTS (
  SELECT 1 FROM program_day_blocks x WHERE x.program_day_id = d.id AND x.order_index = b.ord
);

WITH p AS (SELECT id FROM programs WHERE slug = '5k-ramp-6w')
INSERT INTO program_days (program_id, day_index, title, notes)
SELECT p.id, 1, 'Day 1 — 1:2 intervals', 'Warm up 5min walk. 1min run / 2min walk × 8. Cool down 5min.'
FROM p
ON CONFLICT (program_id, day_index) DO NOTHING;

WITH p AS (SELECT id FROM programs WHERE slug = 'fullbody-db-8w')
INSERT INTO program_days (program_id, day_index, title, notes)
SELECT p.id, 1, 'Day 1 — Full-body A', 'RPE 7. Rest 90s between blocks.'
FROM p
ON CONFLICT (program_id, day_index) DO NOTHING;
