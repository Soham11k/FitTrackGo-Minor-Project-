#!/usr/bin/env node
const baseUrl = process.env.SYNTHETIC_BASE_URL || 'http://localhost:3000'

async function check(path, expectedStatus) {
  const url = `${baseUrl}${path}`
  const response = await fetch(url, { redirect: 'manual' })
  if (response.status !== expectedStatus) {
    throw new Error(`${path} expected ${expectedStatus}, got ${response.status}`)
  }
  console.log(`OK ${path} -> ${response.status}`)
}

try {
  await check('/', 200)
  await check('/api/health', 200)
  await check('/login', 200)
  console.log('Synthetic checks passed')
} catch (error) {
  console.error('Synthetic checks failed:', error instanceof Error ? error.message : String(error))
  process.exit(1)
}
