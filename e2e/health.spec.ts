import { test, expect } from '@playwright/test'

test('health endpoint returns 200 or 503', async ({ request }) => {
  const res = await request.get('/api/health')
  expect([200, 503]).toContain(res.status())
  const body = await res.json()
  expect(body).toHaveProperty('status')
  expect(body).toHaveProperty('timestamp')
})
