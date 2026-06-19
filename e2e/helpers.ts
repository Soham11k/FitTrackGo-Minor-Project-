import { expect, type Page } from "@playwright/test"

/** Splash → login → guest app shell (bottom nav visible). */
export async function enterGuestApp(page: Page) {
  await page.goto("/")
  await expect(page.locator("a, button").first()).toBeVisible({ timeout: 15_000 })
  const guestBtn = page.getByRole("button", { name: /continue as guest/i })
  await expect(guestBtn).toBeVisible({ timeout: 15_000 })
  await guestBtn.click()
  await expect(page.getByTestId("nav-tab-home")).toBeVisible({ timeout: 15_000 })
}

/** Goals tab → first workout card → detail with Start workout. */
export async function openFirstWorkoutDetail(page: Page) {
  await page.getByTestId("nav-tab-exercises").click()
  await expect(page.getByTestId("screen-goals")).toBeVisible({ timeout: 15_000 })
  await page.getByRole("button", { name: /Full Body Strength/i }).click()
  await expect(page.getByRole("button", { name: /^Start workout$/i })).toBeVisible({ timeout: 15_000 })
}
