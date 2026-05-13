-- Run after migrations. You should see many tables (profiles, workouts, runs, …).
-- If this returns zero rows, the full bundle was not applied (see top of _run_in_sql_editor.sql).

select tablename
from pg_catalog.pg_tables
where schemaname = 'public'
order by tablename;
