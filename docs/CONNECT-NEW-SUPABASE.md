# Connect FitTrackGo to a new Supabase project

The app reads **only** environment variables — there is no hard-coded project ID. Point it at a new Supabase project in three steps: **keys → schema → auth URLs**.

## 1. Create the project

1. Open [Supabase Dashboard](https://app.supabase.com) → **New project**.
2. Choose region and a strong **database password** (save it for connection strings).

## 2. Put keys in `.env.local`

1. In the new project: **Settings → API**.
2. Copy into **`.env.local`** (create from [`.env.local.example`](../.env.local.example) if needed):

| Variable | Where to copy |
|----------|----------------|
| `NEXT_PUBLIC_SUPABASE_URL` | **Project URL** (must be `https://….supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **anon** / **publishable** key under Project API keys |
| `SUPABASE_SERVICE_ROLE_KEY` | **service_role** key (server-only; never commit or expose in client code) |

3. Restart the dev server (`npm run dev`) so Next.js picks up changes.

Optional:

- `NEXT_PUBLIC_ARENA_DUELS_LOCAL_ONLY=1` — skip cloud Arena duels if you are not ready to run the `form_duels` migration.

## 3. Apply the database schema (migrations)

FitTrackGo expects tables and RLS from the SQL files under [`supabase/migrations/`](../supabase/migrations/). Apply them **in order** (filename sort = correct order):

1. `20250101000000_initial_core_schema.sql`
2. `20250201000000_wearables_fitbit.sql`
3. `20250301000000_coach_session_competition.sql`
4. `20260601000000_push_notifications.sql`
5. `20260701000000_wearables_breadth.sql`
6. `20260801000000_training_programs.sql`
7. `20260901000000_form_duels.sql` (Arena cloud duels)

**Option A — SQL Editor (simplest):**  
Supabase → **SQL Editor** → New query → paste one file → Run. Repeat for each file in order.

**Option B — `npm run db:push` (from this repo):**  
The script loads `.env.local` and connects if either:

- **`SUPABASE_DB_URL`** is set (full URI from **Settings → Database**), or  
- **`SUPABASE_DB_PASSWORD`** is set (the database password you chose when creating the project) together with **`NEXT_PUBLIC_SUPABASE_URL`**.

```bash
npm run db:push
```

For `--reset` (wipes `public`), use `npm run db:reset`. You can still pass a URI manually:

```bash
export SUPABASE_DB_URL='postgresql://postgres:YOUR_PASSWORD@db.YOUR_REF.supabase.co:5432/postgres'
node scripts/migrate.mjs
```

**Option C — Supabase CLI:**  
`supabase link` to the project, then `supabase db push` (if your CLI project is wired to this repo’s `supabase/migrations`).

## 4. Authentication URLs

**Authentication → URL configuration:**

- **Site URL:** `http://localhost:3000` for local dev (or your production site URL).
- **Redirect URLs:** add your app origins, e.g. `http://localhost:3000/**` and `https://your-domain.com/**`.

If you use **Google / Apple / etc. OAuth**, update the provider’s redirect URI to the **new** project’s callback (shown in Supabase provider settings), not the old project.

## 5. Smoke test

- Sign up / sign in from the app.
- Open **Arena**: cloud duels work only after `20260901000000_form_duels.sql` succeeds and you are **not** using `NEXT_PUBLIC_ARENA_DUELS_LOCAL_ONLY=1`.

## Troubleshooting

- **“Supabase is not configured” / mock client:** Wrong or placeholder env vars, or dev server not restarted after editing `.env.local`. See [`lib/supabase/config.ts`](../lib/supabase/config.ts) for validation rules.
- **Fetch / CORS / wrong host:** `NEXT_PUBLIC_SUPABASE_URL` must be the **Supabase API URL** (`*.supabase.co`), not your Next.js URL. See [`FAILED-TO-FETCH-FIX.md`](../FAILED-TO-FETCH-FIX.md).
