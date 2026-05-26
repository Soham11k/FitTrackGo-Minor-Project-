# Migration checklist (after `git pull`)

Supabase-backed features rely on the schema matching the migrations in `supabase/migrations/`. The app tolerates **some** missing columns (retries / fallbacks), but staying current avoids silent feature gaps.

1. **Pull latest** and scan for new files under `supabase/migrations/`.
2. **Apply migrations** against your linked project:

   ```bash
   npm run db:push
   ```

   (Uses [`scripts/migrate.mjs`](../scripts/migrate.mjs); see [DATABASE-SETUP.md](../DATABASE-SETUP.md) / [SETUP-CHECKLIST.md](../SETUP-CHECKLIST.md).)
3. **Smoke-test** flows that touched new tables/columns (Coach sessions, Arena `form_duels`, programs, wearables, etc.).
4. If something still fails with PostgREST `PGRST204` / “schema cache” messages, run a schema refresh in the Supabase dashboard or redeploy Edge/API if applicable, then retry.
