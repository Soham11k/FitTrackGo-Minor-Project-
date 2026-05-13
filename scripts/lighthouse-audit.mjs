#!/usr/bin/env node
/**
 * Lighthouse placeholder for CI parity (PR C2): run manually with
 * `RUN_LHCI=1 LHCI_URL=https://your-deployment npm run lh:audit`
 * after installing lighthouse locally or wiring your own assertions.
 */

if (!process.env.LHCI_URL || process.env.RUN_LHCI !== '1') {
  console.log('[lhci] Skipped — set RUN_LHCI=1 and LHCI_URL to audit a deployed URL.')
  process.exit(0)
}

console.log('[lhci] RUN_LHCI=1 set — add your lighthouse CLI/assertions pipeline here.')

process.exit(0)
