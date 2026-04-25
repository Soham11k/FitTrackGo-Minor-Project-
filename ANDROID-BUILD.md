# Building an APK from FitTrack Go

You can turn this Next.js app into an Android APK in two ways.

---

## Option 1: Capacitor (recommended for a standalone app)

Capacitor packages your built web app inside a native Android WebView and produces an APK you can install or publish.

### Prerequisites

- **Node.js** 18+
- **Android Studio** (for Android SDK and building the APK)
- **Java 17** (required by Android Gradle Plugin)

### Steps

#### 1. Install Capacitor

```bash
npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap init "FitTrack Go" com.fittrackgo.app
```

#### 2. Build for Android (static export)

The app is built as static files when `BUILD_FOR_ANDROID=1`. Use the provided script:

```bash
npm run build:android
```

This writes the static site into the `out` folder. Use that folder as the Capacitor web root (already set as `webDir: 'out'` in `capacitor.config.ts`).

On **Windows (CMD)** run `set BUILD_FOR_ANDROID=1 && npm run build` instead. On **PowerShell**: `$env:BUILD_FOR_ANDROID=1; npm run build`.

**Note:** Static export cannot run real API routes or OAuth callbacks. `npm run build:android` temporarily swaps **`route.ts`** with **`route.static.ts`** stubs for **auth/callback** and **every `app/api/**/route`** (health, wearables, delete-account, etc.), then restores the real files after the build (see `scripts/prepare-android-build.mjs` / `restore-after-android-build.mjs`). The APK uses **Supabase from the client**; Fitbit OAuth, sync, and other APIs need your **hosted** deployment (or you point the WebView at that URL). For the APK:

- **Email/password sign-in** works as-is (client-side).
- **Google/Apple OAuth:** Deploy this app to a host (e.g. Vercel), set the Supabase redirect URL to your hosted URL (e.g. `https://your-app.vercel.app/auth/callback`). In the Android app you can open that URL in an in-app browser for sign-in, or use Supabase + Capacitor deep links (see [Supabase Auth with Capacitor](https://supabase.com/docs/guides/auth/native-mobile-deep-linking)).

#### 3. Add Android and sync

This repo already has `capacitor.config.ts` with `webDir: 'out'`. Add the Android platform and sync:

```bash
npx cap add android
npm run cap:sync
```

(Or run `npm run android` to build, sync, and open Android Studio in one go.)

#### 4. Open in Android Studio and build APK

```bash
npx cap sync android
npx cap open android
```

In Android Studio: **Build → Build Bundle(s) / APK(s) → Build APK(s)**. The APK is generated under `android/app/build/outputs/apk/`.

#### 5. Scripts already in `package.json`

- `npm run build:android` – static export into `out`
- `npm run cap:sync` – copy `out` into the Android project and update native config
- `npm run android` – build, sync, and open Android Studio

---

## Option 2: PWA → TWA (Trusted Web Activity) APK

If your app is **hosted** (e.g. on Vercel), you can build an APK that is a full-screen Chrome window to your PWA (no separate WebView build).

### Prerequisites

- App deployed at a **public HTTPS URL**
- **Node.js** (for Bubblewrap)

### Steps

1. **Add a web app manifest** (if not already present) so your site is installable. Example `public/manifest.json`:

   ```json
   {
     "name": "FitTrack Go",
     "short_name": "FitTrack Go",
     "start_url": "/",
     "display": "standalone",
     "background_color": "#0a0a0a",
     "theme_color": "#22c55e",
     "orientation": "portrait"
   }
   ```

2. **Install and run Bubblewrap** (Google’s CLI for TWA):

   ```bash
   npm install -g @bubblewrap/cli
   bubblewrap init --manifest=https://YOUR-HOSTED-URL/manifest.json
   ```

   Follow the prompts (app name, package ID, signing key, etc.). Then build the APK:

   ```bash
   bubblewrap build
   ```

   The output APK will be in the generated project folder.

This option does **not** require changing Next.js to static export; the app runs from your hosted URL.

---

## Summary

| Approach   | Best for                         | OAuth / server routes      |
|-----------|----------------------------------|-----------------------------|
| Capacitor | Standalone APK, runs offline-capable | Use hosted callback or deep links for OAuth |
| PWA + TWA | Fastest path, app = hosted site | Works with your current server routes        |

For a **standalone APK** with minimal backend dependency, use **Option 1 (Capacitor)**.  
For the **quickest APK** and you’re fine with the app loading from the web, use **Option 2 (PWA + TWA)**.
