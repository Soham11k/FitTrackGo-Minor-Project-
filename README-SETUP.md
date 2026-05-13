# FitTrackGo - Real Authentication Setup Guide

This guide will help you set up real user authentication and cloud database using Supabase.

## Prerequisites

1. A Supabase account (free at https://supabase.com)
2. Node.js and npm installed
3. Your app running locally

## Step 1: Create a Supabase Project

1. Go to https://app.supabase.com
2. Click "New Project"
3. Fill in:
   - **Name**: FitTrackGo (or your app name)
   - **Database Password**: Choose a strong password (save it!)
   - **Region**: Choose closest to your users
4. Wait for project to be created (2-3 minutes)

## Step 2: Get Your API Keys

1. In your Supabase project, go to **Settings** → **API**
2. Copy these values:
   - **Project URL** (under "Project URL")
   - **anon public** key (under "Project API keys")
   - **service_role** key (under "Project API keys") - Keep this secret!

## Step 3: Set Up Environment Variables

For a **brand-new Supabase project** (new URL and keys), follow **[docs/CONNECT-NEW-SUPABASE.md](docs/CONNECT-NEW-SUPABASE.md)** for keys, migrations in order, and auth URLs.

1. Copy `.env.local.example` to `.env.local`:
   ```bash
   cp .env.local.example .env.local
   ```

2. Open `.env.local` and fill in your Supabase credentials:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
   ```

## Step 4: Set Up Database Schema

1. In Supabase, go to **SQL Editor**
2. Click "New Query"
3. Copy the entire contents of `supabase/schema.sql`
4. Paste into the SQL Editor
5. Click "Run" (or press Cmd/Ctrl + Enter)
6. You should see "Success. No rows returned"

This creates:
- `profiles` table (user profiles)
- `workouts` table (workout records)
- `runs` table (run records)
- `coach_sessions` table (AI Coach sessions)
- `favorites` table (favorite exercises)
- Row Level Security (RLS) policies
- Triggers for auto-creating profiles

## Step 5: Enable OAuth Providers (Optional but Recommended)

### Google OAuth

1. Go to **Authentication** → **Providers** in Supabase
2. Find **Google** and click to expand
3. Toggle "Enable Google provider"
4. You'll need to create OAuth credentials:
   - Go to [Google Cloud Console](https://console.cloud.google.com)
   - Create a new project or select existing
   - Enable Google+ API
   - Go to "Credentials" → "Create Credentials" → "OAuth 2.0 Client ID"
   - Application type: Web application
   - Authorized redirect URIs: `https://your-project-id.supabase.co/auth/v1/callback`
   - Copy Client ID and Client Secret
5. Paste into Supabase Google provider settings
6. Click "Save"

### Apple OAuth

1. Go to **Authentication** → **Providers** in Supabase
2. Find **Apple** and click to expand
3. Toggle "Enable Apple provider"
4. You'll need:
   - Apple Developer account
   - Service ID
   - Key ID and Private Key
   - Team ID
5. Follow [Supabase Apple OAuth guide](https://supabase.com/docs/guides/auth/social-login/auth-apple)

## Step 6: Update Your App Code

The app is already set up to use Supabase! You just need to:

1. **Switch from localStorage to Supabase** - Update imports in components:
   - Change `from "@/lib/store"` to `from "@/lib/store-supabase"` in:
     - `components/dashboard.tsx`
     - `components/exercise-library.tsx`
     - `components/run-tracker.tsx`
     - `components/ai-coach.tsx`
     - `components/profile-screen.tsx`
     - `components/workout-history.tsx`

2. **Update app/page.tsx** to check auth state:
   ```typescript
   // Add this import
   import { createClient } from "@/lib/supabase/client"
   
   // In your component, check auth:
   const supabase = createClient()
   const { data: { user } } = await supabase.auth.getUser()
   ```

## Step 7: Test Authentication

1. Start your dev server: `npm run dev`
2. Try signing up with email/password
3. Check your email for verification (if email confirmation is enabled)
4. Try signing in
5. Test Google/Apple OAuth (if configured)

## Step 8: Configure Email Templates (Optional)

1. Go to **Authentication** → **Email Templates** in Supabase
2. Customize:
   - Confirm signup
   - Reset password
   - Magic link
   - Change email address

## Step 9: Deploy to Production

When deploying (Vercel, Netlify, etc.):

1. Add environment variables in your hosting platform:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (if using server-side operations)

2. Update OAuth redirect URLs:
   - Google: Add your production URL
   - Apple: Add your production URL

## Troubleshooting

### "Not authenticated" errors
- Make sure middleware.ts is working
- Check that RLS policies are correct
- Verify user is signed in: `supabase.auth.getUser()`

### OAuth not working
- Check redirect URLs match exactly
- Verify OAuth credentials are correct
- Check Supabase logs: **Logs** → **Auth Logs**

### Database errors
- Verify schema.sql ran successfully
- Check RLS policies are enabled
- Ensure user has correct permissions

### Email not sending
- Check **Authentication** → **Settings** → **SMTP Settings**
- Supabase free tier has email limits
- Consider using custom SMTP for production

### MediaPipe console warnings (AI Coach / camera)

With **MediaPipe Tasks Vision** (`@mediapipe/tasks-vision` **0.10.34**), the browser may print startup messages such as **FaceBlendshapesGraph acceleration to xnnpack**, **OpenGL error checking is disabled**, lines from **landmark_projection_calculator** / **inference_feedback_manager**, or stack frames mentioning `face_landmarker_graph`, `gl_context`, or `vision_wasm_internal.js`. **These are normal** WASM/runtime diagnostics from Google’s build, not bugs in this app — **safe to ignore** if pose detection, face enrollment, and rep counting behave correctly.

After a successful landmarker init, the app installs a **narrow client-side filter** on `console.warn` / `console.error` for those known patterns only (see [`lib/mediapipe-console-noise.ts`](lib/mediapipe-console-noise.ts)) so the first `detectForVideo` frames don't flood the dev terminal.

Playwright treats matching console output as ignorable noise so CI is not tripped; see [`e2e/ignore-browser-console-noise.ts`](e2e/ignore-browser-console-noise.ts).

## Next Steps

- **Real-time sync**: Enable Supabase Realtime for live updates
- **File storage**: Use Supabase Storage for profile pictures, workout images
- **Analytics**: Set up Supabase Analytics
- **Backups**: Configure automatic database backups
- **Monitoring**: Set up error tracking (Sentry, etc.)

## Support

- [Supabase Docs](https://supabase.com/docs)
- [Supabase Discord](https://discord.supabase.com)
- [Next.js + Supabase Guide](https://supabase.com/docs/guides/getting-started/quickstarts/nextjs)
