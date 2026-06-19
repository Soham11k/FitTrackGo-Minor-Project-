import { test, expect } from "@playwright/test"
import { enterGuestApp, openFirstWorkoutDetail } from "./helpers"

test("guest: coach tab shows AI Coach shell + privacy cue", async ({ page }) => {
  await enterGuestApp(page)

  await page.getByTestId("nav-tab-ai-coach").click()
  await expect(page.getByTestId("screen-ai-coach")).toBeVisible({ timeout: 15_000 })
  await expect(page.getByText(/Privacy:/i)).toBeVisible()
  await expect(page.getByRole("heading", { name: /Choose movement/i })).toBeVisible()
})

test("guest: exercise detail → workout player shows Finish step footer", async ({ page }) => {
  await enterGuestApp(page)
  await openFirstWorkoutDetail(page)

  await page.getByRole("button", { name: /^Start workout$/i }).click()

  await expect(page.getByTestId("screen-workout-player")).toBeVisible({ timeout: 15_000 })
  await expect(page.getByTestId("workout-step-name")).toBeVisible({ timeout: 15_000 })
  await expect(page.getByTestId("workout-step-name")).toHaveText(/Warm up|Squats|Push ups/i)
  await expect(page.getByLabel(/Live pose and camera/i)).toBeVisible({ timeout: 15_000 })
  await expect(page.getByRole("timer")).toBeVisible({ timeout: 15_000 })
  await expect(page.getByRole("button", { name: /Finish this step|Skip rest/i })).toBeVisible({ timeout: 15_000 })
})
