# Get Your Supabase API Keys

Your Supabase project URL is configured: `https://extblftryftjjitcetvq.supabase.co`

## Next Steps:

### 1. Get Your API Keys

1. Go to your Supabase project dashboard:
   **https://app.supabase.com/project/extblftryftjjitcetvq/settings/api**

2. You'll see two keys you need:

   **a) anon public key** (required)
   - This is the long string under "Project API keys" → "anon public"
   - It starts with `eyJ...`
   - Copy this entire key

   **b) service_role key** (optional, for admin operations)
   - Under "Project API keys" → "service_role"
   - Keep this secret! Never expose it in client-side code

### 2. Update .env.local

Open `.env.local` in your project root and replace:

```env
NEXT_PUBLIC_SUPABASE_URL=https://extblftryftjjitcetvq.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=paste-your-anon-key-here
```

### 3. Run Database Schema

1. In Supabase dashboard, go to **SQL Editor**
2. Click **New Query**
3. Open `supabase/schema.sql` in your project
4. Copy the entire contents
5. Paste into SQL Editor
6. Click **Run**

### 4. Restart Dev Server

```bash
npm run dev
```

The setup guide will disappear once your keys are configured!

## Quick Link

**Get your keys here:** https://app.supabase.com/project/extblftryftjjitcetvq/settings/api
