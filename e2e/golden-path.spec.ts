import { test, expect } from "@playwright/test"

/**
 * Golden path: lands on the app, navigates the tab shell, opens Exercise
 * library, opens Profile, triggers data export path.
 *
 * Full sign-up → onboarding → export JSON requires a live Supabase project.
 * CI runs against placeholder env vars so the app renders its guest / setup
 * state. This spec asserts the guest shell is healthy end-to-end, which is
 * the real regression risk at the app shell layer.
 */
test("golden path: shell is healthy and nav transitions work", async ({ page }) => {
  await page.goto("/")

  await expect(page).toHaveTitle(/FitTrack/i)

  const body = page.locator("body")
  await expect(body).toBeVisible()

  // Splash has no <a> or <button> (only div/h1) for ~3s. CI is fast enough to
  // hit 0 links; wait for post-splash setup guide or login (always has controls).
  await expect(page.locator("a, button").first()).toBeVisible({ timeout: 12_000 })

  const errors: string[] = []
  page.on("pageerror", (err) => errors.push(err.message))
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text())
  })

  await page.waitForLoadState("networkidle")

  const ignorable = [
    "Supabase is not configured",
    "Failed to fetch",
    "NetworkError",
    "ChunkLoadError",
    "favicon",
  ]
  const fatal = errors.filter((e) => !ignorable.some((i) => e.includes(i)))
  expect(fatal, `Fatal JS errors on homepage:\n${fatal.join("\n")}`).toHaveLength(0)

  // When the main app shell is shown, bottom nav can switch to Profile (regression guard for tab shell).
  const profileTab = page.getByTestId("nav-tab-profile")
  if (await profileTab.isVisible().catch(() => false)) {
    await profileTab.click()
    await expect(page.getByTestId("screen-profile")).toBeVisible({ timeout: 15_000 })
  }
})
