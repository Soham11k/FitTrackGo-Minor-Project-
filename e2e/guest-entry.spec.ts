import { test, expect } from "@playwright/test"

/**
 * Regression: guest must enter the app shell and not bounce back to login
 * when Supabase project API is unreachable (dev mock / ECONNRESET path).
 */
test("guest entry stays in app shell", async ({ page }) => {
  await page.goto("/")

  await expect(page.locator("a, button").first()).toBeVisible({ timeout: 15_000 })
  const guestBtn = page.getByRole("button", { name: /continue as guest/i })
  await expect(guestBtn).toBeVisible({ timeout: 15_000 })

  await guestBtn.click()

  await expect(page.getByTestId("nav-tab-home")).toBeVisible({ timeout: 15_000 })
  await expect(page.getByRole("heading", { name: /welcome back/i })).not.toBeVisible({ timeout: 5_000 })
})
