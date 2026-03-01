# How to fix "Failed to fetch" and Auth errors (Supabase / profile load)

## If you see: `Unexpected token '<', "<!DOCTYPE "... is not valid JSON` (AuthUnknownError)

The Supabase Auth client expected a **JSON** response but got **HTML**. That usually means:

1. **Wrong `NEXT_PUBLIC_SUPABASE_URL`** – It must be your Supabase API URL, e.g. `https://xxxxx.supabase.co`. If it points at your app (e.g. `http://localhost:3000`) or has a typo, the auth request hits an HTML page and this error appears.
2. **Project paused** – Free-tier projects pause after inactivity. In [Supabase Dashboard](https://app.supabase.com) → your project, click **Restore** if you see “Project paused”. Until then, auth requests may get an HTML “paused” page.
3. **Restart after changing env** – After fixing `.env.local`, **restart the dev server** (`npm run dev`).

Then follow the steps below to confirm URL and key.

---

## "Failed to fetch"

"Failed to fetch" means the browser could not complete the request to Supabase. Fix it by checking these in order:

---

## 1. Create and fill `.env.local`

In the **project root** (same folder as `package.json`), create a file named `.env.local` with:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT-ID.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

- Get both values from: [Supabase Dashboard](https://app.supabase.com) → your project → **Settings** → **API**.
- **Project URL** → `NEXT_PUBLIC_SUPABASE_URL` (must start with `https://`).
- **Project API keys** → **anon public** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

Then **restart the dev server** (stop and run `npm run dev` again) so Next.js picks up the new env.

---

## 2. Check Supabase project is running

- Free-tier projects **pause** after inactivity.
- In [Supabase Dashboard](https://app.supabase.com) → your project, if you see “Project paused”, click **Restore**.
- Wait a minute and try the app again.

---

## 3. Check URL and key

- **URL:** Must be exactly `https://xxxx.supabase.co` (no trailing slash, no typo).
- **Anon key:** Long string starting with `eyJ...` (JWT). Copy again from Dashboard → Settings → API → anon public.

---

## 4. Network / browser

- Try another network (e.g. turn off VPN, or use mobile hotspot).
- Disable browser extensions that block requests (ad blockers, privacy extensions).
- Open DevTools (F12) → **Network** tab, reload, and see if the request to `supabase.co` is **blocked**, **canceled**, or **failed** (status or error message there helps).

---

## 5. CORS (only if you’re on a custom domain)

- For **localhost**, Supabase allows it by default.
- If you deploy to a custom domain, in Supabase: **Settings** → **API** → add your site URL under allowed origins if needed.

---

## Summary

| Cause              | Fix |
|--------------------|-----|
| No `.env.local`    | Create it with correct URL and anon key, restart dev server. |
| Wrong URL/key      | Copy again from Supabase Dashboard → Settings → API. |
| Project paused     | Restore project in Supabase Dashboard. |
| VPN / firewall     | Try another network or disable VPN. |
| Ad blocker         | Disable for localhost or add an exception. |

After changing `.env.local`, always **restart** the Next.js dev server.
