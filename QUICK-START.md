# Quick Start: Real Authentication Setup

## 5-Minute Setup

### 1. Create Supabase Project
1. Go to https://app.supabase.com → New Project
2. Wait 2-3 minutes for setup

### 2. Get API Keys
1. Settings → API
2. Copy: Project URL, anon key, service_role key

### 3. Set Environment Variables
```bash
cp .env.local.example .env.local
# Edit .env.local with your keys
```

### 4. Run Database Schema
1. Supabase Dashboard → SQL Editor
2. Copy/paste contents of `supabase/schema.sql`
3. Click Run

### 5. Update Components (One-Time)
Replace `@/lib/store` with `@/lib/store-supabase` in:
- dashboard.tsx
- exercise-library.tsx
- run-tracker.tsx
- ai-coach.tsx
- profile-screen.tsx
- workout-history.tsx

**Important:** Store functions are now async! Update your code:
```typescript
// Before
const profile = getProfile()

// After
const [profile, setProfile] = useState(null)
useEffect(() => {
  getProfile().then(setProfile)
}, [])
```

### 6. Enable OAuth (Optional)
1. Authentication → Providers
2. Enable Google/Apple
3. Add OAuth credentials

### 7. Test!
```bash
npm run dev
```

Try signing up → Check email → Sign in → Test features!

## What You Get

✅ **Real user accounts** - Email/password + OAuth  
✅ **Cloud database** - PostgreSQL with RLS  
✅ **Data sync** - Works across devices  
✅ **Secure** - Row-level security policies  
✅ **Scalable** - Free tier, then pay-as-you-go  

## Next Steps

- See `README-SETUP.md` for detailed guide
- See `MIGRATION-GUIDE.md` for migrating existing data
- Configure email templates in Supabase
- Set up production environment variables
