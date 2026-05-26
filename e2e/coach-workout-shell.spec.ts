import { test, expect } from "@playwright/test"

test("guest: coach tab shows AI Coach shell + privacy cue", async ({ page }) => {
  await page.goto("/")
  await expect(page.locator("a, button").first()).toBeVisible({ timeout: 15_000 })
  await page.getByRole("button", { name: /continue as guest/i }).click()
  await expect(page.getByTestId("nav-tab-home")).toBeVisible({ timeout: 15_000 })

  await page.getByTestId("nav-tab-ai-coach").click()
  await expect(page.getByTestId("screen-ai-coach")).toBeVisible({ timeout: 15_000 })
  await expect(page.getByText(/Privacy:/i)).toBeVisible()
  await expect(page.getByRole("heading", { name: /AI Body Coach/i })).toBeVisible()
})

test("guest: exercise detail → workout player shows Finish step footer", async ({ page }) => {
  await page.goto("/")
  await expect(page.locator("a, button").first()).toBeVisible({ timeout: 15_000 })
  await page.getByRole("button", { name: /continue as guest/i }).click()
  await expect(page.getByTestId("nav-tab-home")).toBeVisible({ timeout: 15_000 })

  await page.getByTestId("nav-tab-exercises").click()

  await page.getByRole("button", { name: /^Open workout:/i }).click()
  await expect(page.getByRole("button", { name: /^Start Workout$/i })).toBeVisible({ timeout: 15_000 })
  await page.getByRole("button", { name: /^Start Workout$/i }).click()

  await expect(page.getByTestId("screen-workout-player")).toBeVisible({ timeout: 15_000 })
  await expect(page.getByTestId("workout-step-name")).toBeVisible({ timeout: 15_000 })
  await expect(page.getByTestId("workout-step-name")).toHaveText(/Warm up|Squats|Push ups/i)
  await expect(page.getByText(/Live body tracking/i)).toBeVisible({ timeout: 15_000 })
  await expect(page.getByRole("timer")).toBeVisible({ timeout: 15_000 })
  await expect(page.getByRole("button", { name: /Finish this step|Skip rest/i })).toBeVisible({ timeout: 15_000 })
})
