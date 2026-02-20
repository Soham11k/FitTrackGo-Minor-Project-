# Supabase Setup Checklist

Follow these steps to get your app running with real authentication and cloud features.

## ✅ Quick Setup (5 minutes)

### 1. Create Supabase Project
- [ ] Go to https://app.supabase.com
- [ ] Click "New Project"
- [ ] Fill in project details:
  - Name: FitTrackGo (or your choice)
  - Database Password: Choose a strong password (save it!)
  - Region: Choose closest to your users
- [ ] Wait 2-3 minutes for project creation

### 2. Get API Credentials
- [ ] In Supabase dashboard, go to **Settings** → **API**
- [ ] Copy **Project URL** (looks like: `https://xxxxx.supabase.co`)
- [ ] Copy **anon public** key (long string starting with `eyJ...`)
- [ ] (Optional) Copy **service_role** key (keep this secret!)

### 3. Create Environment File
- [ ] In your project root, create `.env.local`:
  ```bash
  cp .env.local.example .env.local
  ```
- [ ] Open `.env.local` in a text editor
- [ ] Replace `your-project-url-here` with your Project URL
- [ ] Replace `your-anon-key-here` with your anon key
- [ ] Save the file

### 4. Run Database Schema
- [ ] In Supabase dashboard, go to **SQL Editor**
- [ ] Click **New Query**
- [ ] Open `supabase/schema.sql` in your project
- [ ] Copy the entire contents
- [ ] Paste into SQL Editor
- [ ] Click **Run** (or press Cmd/Ctrl + Enter)
- [ ] Should see "Success. No rows returned"

### 5. Restart Dev Server
- [ ] Stop your dev server (Ctrl+C)
- [ ] Run `npm run dev` again
- [ ] The setup guide should disappear
- [ ] Try signing up with email/password

## ✅ Optional: Enable OAuth

### Google OAuth
- [ ] Follow `OAUTH-SETUP.md` → Google OAuth Setup
- [ ] Create OAuth credentials in Google Cloud Console
- [ ] Configure in Supabase → Authentication → Providers → Google

### Apple OAuth
- [ ] Follow `OAUTH-SETUP.md` → Apple OAuth Setup
- [ ] Requires Apple Developer Account ($99/year)
- [ ] Configure in Supabase → Authentication → Providers → Apple

## ✅ Verify Everything Works

- [ ] Sign up with email/password works
- [ ] Sign in works
- [ ] Profile loads correctly
- [ ] Can save workouts
- [ ] Can save runs
- [ ] Can save AI Coach sessions
- [ ] Favorites work
- [ ] Stats calculate correctly
- [ ] Logout works

## 🐛 Troubleshooting

### "Supabase not configured" error
- Check `.env.local` exists and has correct values
- Restart dev server after creating `.env.local`
- Verify no typos in variable names

### "Not authenticated" errors
- Make sure you're signed in
- Check browser console for errors
- Verify RLS policies are enabled in Supabase

### Database errors
- Verify `schema.sql` ran successfully
- Check Supabase → Logs → Postgres Logs
- Ensure tables exist: `profiles`, `workouts`, `runs`, `coach_sessions`, `favorites`

### OAuth not working
- Verify redirect URLs match exactly
- Check OAuth credentials are correct
- Review Supabase → Logs → Auth Logs

## 📚 Next Steps

- [ ] Customize email templates in Supabase
- [ ] Set up production environment variables
- [ ] Configure custom domain (optional)
- [ ] Set up database backups
- [ ] Enable monitoring/analytics

## 📖 Documentation

- `README-SETUP.md` - Detailed setup guide
- `QUICK-START.md` - 5-minute quick start
- `OAUTH-SETUP.md` - OAuth configuration
- `MIGRATION-GUIDE.md` - Migrating from localStorage

## 🆘 Need Help?

- Check Supabase logs: Dashboard → Logs
- Review browser console for errors
- Check Supabase Discord: https://discord.supabase.com
- Read Supabase docs: https://supabase.com/docs
