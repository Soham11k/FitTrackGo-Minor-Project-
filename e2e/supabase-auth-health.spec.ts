import { test, expect } from "@playwright/test"

/**
 * Dev-only: browser can reach Supabase auth health via /api/diag/supabase-proxy.
 * CI runs `next start` (production), where that route is intentionally 404.
 */
test("browser reaches supabase auth health", async ({ page }) => {
  await page.goto("/")
  await expect(page.locator("a, button").first()).toBeVisible({ timeout: 15_000 })

  const diag = await page.evaluate(async () => {
    const r = await fetch("/api/diag/supabase-proxy?fresh=1", { cache: "no-store" })
    if (r.status === 404) return { kind: "prod" as const }
    const j = (await r.json()) as { authReachable?: boolean; configured?: boolean }
    return {
      kind: "dev" as const,
      configured: j.configured === true,
      authReachable: j.authReachable === true,
    }
  })

  if (diag.kind === "prod") {
    test.info().annotations.push({
      type: "note",
      description: "Skipped auth health assertion — diag route is dev-only.",
    })
    return
  }

  if (!diag.configured) {
    test.info().annotations.push({
      type: "note",
      description: "Skipped auth health assertion — Supabase not configured.",
    })
    return
  }

  expect(diag.authReachable).toBe(true)
})
