# OAuth Setup Guide - Google & Apple Sign-In

This guide will help you enable Google and Apple OAuth authentication in your FitTrackGo app.

## Prerequisites

- Supabase project created
- Environment variables configured
- Database schema deployed

## Google OAuth Setup

### Step 1: Create Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select an existing one
3. Enable the **Google+ API**:
   - Go to "APIs & Services" → "Library"
   - Search for "Google+ API"
   - Click "Enable"

### Step 2: Create OAuth 2.0 Client ID

1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "OAuth 2.0 Client ID"
3. Configure OAuth consent screen (if prompted):
   - User Type: External
   - App name: FitTrackGo (or your app name)
   - User support email: Your email
   - Developer contact: Your email
   - Click "Save and Continue"
   - Scopes: Leave default, click "Save and Continue"
   - Test users: Add your email, click "Save and Continue"

4. Create OAuth Client:
   - Application type: **Web application**
   - Name: FitTrackGo Web
   - Authorized redirect URIs: 
     ```
     https://YOUR_PROJECT_ID.supabase.co/auth/v1/callback
     ```
     Replace `YOUR_PROJECT_ID` with your Supabase project ID
   - Click "Create"
5. Copy the **Client ID** and **Client Secret**

### Step 3: Configure in Supabase

1. Go to your Supabase project dashboard
2. Navigate to **Authentication** → **Providers**
3. Find **Google** and click to expand
4. Toggle "Enable Google provider"
5. Enter:
   - **Client ID**: From Google Cloud Console
   - **Client Secret**: From Google Cloud Console
6. Click "Save"

### Step 4: Test Google OAuth

1. Start your app: `npm run dev`
2. Click "Sign in with Google"
3. You should be redirected to Google sign-in
4. After signing in, you'll be redirected back to your app

## Apple OAuth Setup

### Step 1: Apple Developer Account

You need an **Apple Developer Account** ($99/year). If you don't have one, skip Apple OAuth for now.

### Step 2: Create App ID

1. Go to [Apple Developer Portal](https://developer.apple.com)
2. Navigate to "Certificates, Identifiers & Profiles"
3. Go to "Identifiers" → Click "+"
4. Select "App IDs" → Continue
5. Select "App" → Continue
6. Description: FitTrackGo
7. Bundle ID: `com.yourcompany.fittrackgo` (must be unique)
8. Enable "Sign in with Apple"
9. Click "Continue" → "Register"

### Step 3: Create Service ID

1. In "Identifiers", click "+"
2. Select "Services IDs" → Continue
3. Description: FitTrackGo Web
4. Identifier: `com.yourcompany.fittrackgo.web`
5. Enable "Sign in with Apple"
6. Click "Configure"
7. Primary App ID: Select your App ID
8. Website URLs:
   - Domains: `YOUR_PROJECT_ID.supabase.co`
   - Return URLs: `https://YOUR_PROJECT_ID.supabase.co/auth/v1/callback`
9. Click "Save" → "Continue" → "Register"

### Step 4: Create Key

1. Go to "Keys" → Click "+"
2. Key Name: FitTrackGo Sign In Key
3. Enable "Sign in with Apple"
4. Click "Configure"
5. Select your Primary App ID
6. Click "Save" → "Continue" → "Register"
7. **Download the key file** (.p8) - you can only download it once!
8. Note the **Key ID**

### Step 5: Get Team ID

1. In Apple Developer Portal, go to "Membership"
2. Copy your **Team ID** (10-character string)

### Step 6: Configure in Supabase

1. Go to Supabase → **Authentication** → **Providers**
2. Find **Apple** and click to expand
3. Toggle "Enable Apple provider"
4. Enter:
   - **Services ID**: `com.yourcompany.fittrackgo.web`
   - **Secret Key**: Contents of the .p8 file you downloaded
   - **Key ID**: From Step 4
   - **Team ID**: From Step 5
5. Click "Save"

### Step 7: Test Apple OAuth

1. Start your app: `npm run dev`
2. Click "Sign in with Apple"
3. You should see Apple sign-in modal
4. After signing in, you'll be redirected back

## Troubleshooting

### Google OAuth Issues

**"redirect_uri_mismatch" error:**
- Verify redirect URI in Google Console matches exactly: `https://YOUR_PROJECT_ID.supabase.co/auth/v1/callback`
- No trailing slashes
- Must be HTTPS

**"access_denied" error:**
- Check OAuth consent screen is configured
- Verify test users are added (if app is in testing mode)
- Check scopes are enabled

### Apple OAuth Issues

**"invalid_client" error:**
- Verify Service ID matches exactly
- Check Key ID and Team ID are correct
- Ensure .p8 key file content is correct (no extra spaces)

**"invalid_request" error:**
- Verify return URLs match exactly in Apple Developer Portal
- Check domain is correct

### General Issues

**OAuth button doesn't work:**
- Check browser console for errors
- Verify Supabase environment variables are set
- Check Supabase Auth logs: **Logs** → **Auth Logs**

**User not created:**
- Check Supabase Auth logs
- Verify database trigger is working (profile should auto-create)
- Check RLS policies allow insert

## Production Setup

When deploying to production:

1. **Update Redirect URLs:**
   - Google: Add production URL to authorized redirect URIs
   - Apple: Update return URLs in Service ID configuration

2. **Update OAuth Consent Screen:**
   - Google: Submit for verification (if needed)
   - Apple: Update app information

3. **Environment Variables:**
   - Ensure production environment has Supabase keys
   - Never commit `.env.local` to git

## Security Best Practices

1. ✅ Use HTTPS in production
2. ✅ Keep OAuth secrets secure (environment variables)
3. ✅ Regularly rotate OAuth credentials
4. ✅ Monitor auth logs for suspicious activity
5. ✅ Use Row Level Security (RLS) policies
6. ✅ Validate user data on server side

## Next Steps

- Set up email templates in Supabase
- Configure password reset flow
- Add social profile picture sync
- Implement account linking (connect multiple providers)

## Resources

- [Supabase Auth Docs](https://supabase.com/docs/guides/auth)
- [Google OAuth Guide](https://developers.google.com/identity/protocols/oauth2)
- [Apple Sign In Guide](https://developer.apple.com/sign-in-with-apple/)
- [Supabase Discord](https://discord.supabase.com) - Get help from community
