import { test, expect } from '@playwright/test'

test('app loads and shows UI content', async ({ page }) => {
  await page.goto('/')
  await page.waitForTimeout(5000)
  const buttons = page.getByRole('button')
  const count = await buttons.count()
  expect(count).toBeGreaterThan(0)
})

test('app has clickable buttons after load', async ({ page }) => {
  await page.goto('/')
  await page.waitForTimeout(5000)
  const firstButton = page.getByRole('button').first()
  await expect(firstButton).toBeEnabled()
})
