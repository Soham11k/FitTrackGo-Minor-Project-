import { test, expect } from "@playwright/test"

/**
 * Regression: guest must enter the app shell and not bounce back to login
 * when Supabase project API is unreachable (dev mock / ECONNRESET path).
 */
test("guest entry stays in app shell", async ({ page }) => {
  await page.goto("/")

  await expect(page.locator("a, button").first()).toBeVisible({ timeout: 15_000 })
  await expect(page.getByPlaceholder("EMAIL ADDRESS")).toBeVisible({ timeout: 15_000 })

  await page
    .getByRole("button", { name: /continue as guest — works without cloud/i })
    .click()

  await expect(page.getByTestId("nav-tab-home")).toBeVisible({ timeout: 15_000 })
  await expect(page.getByPlaceholder("EMAIL ADDRESS")).not.toBeVisible({ timeout: 5_000 })
})
