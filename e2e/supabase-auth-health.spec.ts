import { test, expect } from "@playwright/test"

/** Browser can reach Supabase auth health (direct or via dev proxy). */
test("browser reaches supabase auth health", async ({ page }) => {
  await page.goto("/")
  await expect(page.locator("a, button").first()).toBeVisible({ timeout: 15_000 })

  const result = await page.evaluate(async () => {
    const r = await fetch("/api/diag/supabase-proxy?fresh=1", { cache: "no-store" })
    const j = (await r.json()) as { authReachable?: boolean }
    return j.authReachable === true
  })

  expect(result).toBe(true)
})
