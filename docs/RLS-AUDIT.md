# Row-Level Security Audit

Date: 2026-04-15 (initial)
Owner: Platform
Re-review cadence: every new migration + before each production cut.

Every RLS policy in this project must satisfy three properties:

1. **Owned**: reads, writes, updates, and deletes are gated by `auth.uid()`.
2. **Closed by default**: tables have `ENABLE ROW LEVEL SECURITY`; no implicit `USING (TRUE)` unless the table is a public catalog (e.g. `programs`).
3. **Server re-checks ownership**: any API route under `app/api/` that performs DB writes with a user-scoped Supabase client must additionally compare the resource owner to the authenticated user *before* issuing the write. This is belt-and-braces against misconfigured policies.

## Per-table state

| Table                           | RLS on | SELECT                  | INSERT                       | UPDATE                   | DELETE                  | Notes                                                                                                     |
| ------------------------------- | ------ | ----------------------- | ---------------------------- | ------------------------ | ----------------------- | --------------------------------------------------------------------------------------------------------- |
| `profiles`                      | yes    | `auth.uid() = id`       | `auth.uid() = id`            | `auth.uid() = id`        | (no policy)             | Deletes cascade via `auth.users` ON DELETE CASCADE. No client-facing deletes required.                    |
| `workouts`                      | yes    | `auth.uid() = user_id`  | `auth.uid() = user_id`       | (no policy)              | `auth.uid() = user_id`  | Updates not supported; history is append-only.                                                            |
| `runs`                          | yes    | `auth.uid() = user_id`  | `auth.uid() = user_id`       | (no policy)              | `auth.uid() = user_id`  | Same append-only policy as workouts.                                                                      |
| `coach_sessions`                | yes    | `auth.uid() = user_id`  | `auth.uid() = user_id`       | (no policy)              | `auth.uid() = user_id`  | Phase 5 adds `effective_reps`/`verified_movement` — both ownership-scoped.                                |
| `favorites`                     | yes    | `auth.uid() = user_id`  | `auth.uid() = user_id`       | (no policy)              | `auth.uid() = user_id`  | Unique index prevents duplicates.                                                                         |
| `wearable_connections`          | yes    | **no policy**           | **no policy**                | **no policy**            | **no policy**           | Intentionally inaccessible to the client. Only the service-role server uses this table (`lib/wearables`). |
| `wearable_daily_metrics`        | yes    | **no policy**           | **no policy**                | **no policy**            | **no policy**           | Same — server-side only.                                                                                  |
| `push_subscriptions`            | yes    | `auth.uid() = user_id`  | `auth.uid() = user_id`       | (no policy)              | `auth.uid() = user_id`  | Phase 6. Server sender uses service-role to enumerate all subscriptions.                                  |
| `notification_preferences`      | yes    | `auth.uid() = user_id`  | `auth.uid() = user_id`       | `auth.uid() = user_id`   | (no policy)             | One row per user.                                                                                         |
| `programs`                      | yes    | `USING (TRUE)`          | (no policy)                  | (no policy)              | (no policy)             | Read-only catalog; writes only via service-role/seed.                                                     |
| `program_days`                  | yes    | `USING (TRUE)`          | (no policy)                  | (no policy)              | (no policy)             | Same.                                                                                                     |
| `program_day_blocks`            | yes    | `USING (TRUE)`          | (no policy)                  | (no policy)              | (no policy)             | Same.                                                                                                     |
| `user_program_enrollments`      | yes    | `auth.uid() = user_id`  | `auth.uid() = user_id`       | `auth.uid() = user_id`   | `auth.uid() = user_id`  | One per (user, program).                                                                                  |
| `program_adherence`             | yes    | `enrollment.user_id = auth.uid()` | same                | (no policy)              | (no policy)             | Ownership is derived by join on `user_program_enrollments`.                                               |

## Server-side re-checks

All routes that issue privileged writes are enumerated in
[app/api](../app/api). Each must:

1. Call `supabase.auth.getUser()` and redirect/reject if unauthenticated.
2. If the request references a resource id (e.g. `runId`, `enrollmentId`, `workoutId`), `SELECT` it with the user-scoped client and confirm `row.user_id === user.id` before mutating.
3. Only use `lib/supabase/service-role.ts` when strictly necessary (wearable token refresh, push send, seed scripts). Never return service-role responses verbatim to the client.

## Threat model — rejected attacks

| Attack                                                                                       | Mitigation                                                      |
| -------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Forge `user_id` in insert payload (e.g. POST `/api/runs` with another user's id)             | RLS `WITH CHECK (auth.uid() = user_id)` + server re-check.      |
| Read another user's coach sessions via a crafted `.select()` on the browser client           | RLS `USING (auth.uid() = user_id)` rejects at the DB.           |
| Read wearable OAuth tokens by spoofing a Supabase JWT                                        | No policy exists for `wearable_connections`; only service role. |
| Subscribe another user to a push endpoint                                                    | RLS `WITH CHECK (auth.uid() = user_id)`.                        |
| Mark another user's program day as complete                                                  | `program_adherence` WITH CHECK joins `user_program_enrollments` ownership. |

## How to verify locally

Manual spot-check once Supabase CLI is available:

```bash
# Apply all migrations and seed data to a fresh local db.
supabase db reset

# Open a psql session as a specific user (set auth.uid() via JWT), then try:
INSERT INTO runs (user_id, distance, duration, pace, calories)
VALUES ('<other-user-uuid>', 1, 60, '1:00', 10);
-- expected: RLS denial.
```

A forthcoming Playwright E2E step (Phase 2) will automate this using a second
test account.

## Operational actions (each release)

1. After applying new migrations in Supabase, confirm `lib/supabase/database.types.ts` still matches (regenerate if you use codegen).
2. Spot-check with two test accounts that neither can read the other’s `workouts`, `runs`, or `coach_sessions` rows (SQL or Table Editor).
3. Re-read [API-SECURITY-ROUTES.md](./API-SECURITY-ROUTES.md) for any new `app/api` route.

## Open items / known gaps

- `profiles` currently has no DELETE policy. Deletion is handled by
  `auth.users` cascade; if we later allow "delete my account" without Supabase
  admin API, add an explicit policy.
- `wearable_*` tables rely on "no policy at all" to deny clients. Add a
  belt-and-braces `CREATE POLICY ... USING (FALSE)` if we ever need to prove
  defense-in-depth to an audit.
- A future ADR should decide whether `verified_movement` should be
  UPDATEable by users (currently append-only).
