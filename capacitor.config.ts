import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.fittrackgo.app',
  appName: 'FitTrack Go',
  webDir: 'out',
  server: {
    // Clear in production; use if you need to point to a different origin in dev
    // url: 'http://localhost:3000',
    // cleartext: true,
  },
  android: {
    allowMixedContent: true,
  },
}

export default config
