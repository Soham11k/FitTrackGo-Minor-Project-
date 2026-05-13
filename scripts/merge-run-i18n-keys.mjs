#!/usr/bin/env node
import fs from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))

const EXTRA = {
  "run.gps.active": "GPS active",
  "run.gps.searching": "Searching…",
  "run.gps.simulated": "Simulated",
  "run.gps.ready": "Ready",
  "run.httpsGPS": "Use HTTPS for real GPS",
  "run.ready.title": "Ready to Run",
  "run.ready.subtitle": "Tap Start — your route will appear on the map",
  "run.ready.afterHint": "Your runs will show here after you finish one.",
  "run.https.banner": "For real GPS, use HTTPS or localhost. Some browsers block location on plain HTTP.",
  "run.splits": "Splits / Laps",
  "run.stat.distance": "Distance",
  "run.stat.time": "Time",
  "run.stat.pace": "Pace",
  "run.stat.cal": "Cal",
  "run.stat.energy": "Energy",
  "run.kmAbbrev": "Km",
  "run.saving": "Saving…",
  "run.saved.title": "Run saved",
  "run.saved.close": "Close",
  "run.saved.noTrail": "No GPS trail — distance and pace still saved.",
  "run.saved.done": "Done",
  "run.saved.share": "Share",
  "run.saved.map": "Map",
  "run.saved.routeTooltip": "Route shown above",
  "run.share.nativeTitle": "My run",
  "run.share.copied": "Copied run summary",
  "run.share.failed": "Could not share or copy",
  "run.split.paceLabel": "Split pace",
  "run.split.fastest": " · fastest",
  "run.split.slowest": " · slowest",
  "run.split.insight":
    "Strongest pace on km {{best}}. Tough split: km {{worst}}.",
  "wearable.liveHrBluetooth": "Live HR (Bluetooth)",
  "wearable.errorPrefix": "Wearables:",
  "wearable.vitalsNeedLink": "Vitals need a link",
  "wearable.vitalsNeedLinkDesc":
    "Connect Fitbit in Profile to pull resting heart rate and nightly SpO₂ summaries into Home.",
  "wearable.goProfile": "Go to Profile",
  "wearable.pairing": "Pairing…",
  "wearable.pairBluetoothHr": "Pair Bluetooth HR",
  "wearable.readiness": "Readiness",
  "wearable.tapGraph": "Tap · graph",
  "wearable.disconnect": "Disconnect",
  "wearable.bleIntro":
    "Live HR from this phone over Bluetooth (standard BLE chest straps and sensors). Fitbit watches normally sync through the Fitbit app and cloud—most won't pair here.",
  "wearable.vitalsTitle": "Vitals",
  "wearable.readinessDisclaimer": "Indicative, not medical.",
  "wearable.label.heartRate": "Heart rate",
  "wearable.label.restingHrDaily": "Resting HR (daily)",
  "wearable.label.restingHrRecent": "Resting HR (recent)",
  "wearable.label.restingHrSynced": "Resting HR (synced)",
  "activity.runDetailTitle": "Run detail",
  "activity.noGpsTrail": "No GPS trail recorded",
  "activity.shareTitle": "My run",
  "activity.copied": "Copied run summary",
  "activity.shareFailed": "Could not share or copy",
}

const root = join(__dirname, "..")
for (const locale of fs.readdirSync(join(root, "messages"))) {
  if (!locale.endsWith(".json")) continue
  const p = join(root, "messages", locale)
  const j = JSON.parse(fs.readFileSync(p, "utf8"))
  for (const [k, v] of Object.entries(EXTRA)) {
    if (!(k in j)) j[k] = v
  }
  fs.writeFileSync(p, JSON.stringify(j, null, 2) + "\n")
}
console.log("merged run keys into messages/*.json")
