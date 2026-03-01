# What to Do Next (Development Ideas)

The app is in good shape for personal use and demos. If you want to polish it further or ship to others, consider the items below.

---

## Done in This Repo

- **Android permissions** — `AndroidManifest.xml` now requests **location** (run tracker) and **camera** (Coach Assist). Rebuild the APK so the app can ask for these on first use.

---

## Recommended (High Value)

1. **Rebuild the APK**  
   After the permission changes, run `npm run android` and build a new APK. On first launch, the app will prompt for location (when you start a run) and camera (when you use Coach Assist).

2. **OAuth on Android**  
   Google/Apple sign-in in the APK needs a hosted callback. Deploy the app (e.g. Vercel), set Supabase redirect URL to `https://your-domain.com/auth/callback`, and optionally wire deep links so the app opens after login. Until then, use **email/password** sign-in in the APK.

3. **Error boundary**  
   Add a root or layout-level React error boundary (`error.tsx` in the app router) so a single component crash doesn’t blank the whole screen.

---

## Optional (Nice to Have)

4. **Offline / network errors**  
   Show a clear message when the network fails (e.g. after a run or when loading dashboard) and optionally queue actions to retry when back online.

5. **Run in background**  
   On Android, the run can pause if the app is backgrounded. For long runs, consider a foreground service or at least a “keep screen on during run” option.

6. **More tests**  
   Add tests for run tracker (e.g. distance/pace logic), auth flow, or critical UI (e.g. login, dashboard).

7. **Accessibility**  
   Review focus order, labels, and contrast so the app works well with screen readers and keyboard/switch access.

8. **App icon and splash**  
   Replace the default Capacitor icon and splash with FitTrack Go branding in `android/app/src/main/res/` and Capacitor splash config.

---

## Later / If You Scale

- Rate limiting or abuse protection on auth (e.g. Supabase or edge rules).
- Backend validation for contact form if you use an endpoint (e.g. serverless function).
- Analytics or crash reporting (e.g. Vercel Analytics already in use; add Sentry or similar if you want error tracking).

---

**Summary:** Rebuild the APK so the new permissions are included, then tackle OAuth on Android and an error boundary. The rest can wait until you need them.
