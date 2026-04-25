import { test, expect } from '@playwright/test'

test('homepage loads with correct title', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle(/FitTrack/i)
})

test('homepage renders visible content', async ({ page }) => {
  await page.goto('/')
  await page.waitForTimeout(3000)
  const content = page.locator('body > *')
  const count = await content.count()
  expect(count).toBeGreaterThan(0)
})
