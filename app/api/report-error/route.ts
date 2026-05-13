import { NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import { checkRateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

interface ErrorReport {
  message?: string
  digest?: string
  name?: string
  stack?: string
  url?: string
  userAgent?: string
}

function getClientIp(request: Request): string {
  const xff = request.headers.get('x-forwarded-for')
  if (xff) {
    const first = xff.split(',')[0]?.trim()
    if (first) return first
  }
  return request.headers.get('x-real-ip') || 'unknown'
}

export async function POST(request: Request) {
  const ip = getClientIp(request)
  const rate = await checkRateLimit({
    key: `error-report:${ip}`,
    limit: 30,
    windowMs: 60 * 1000,
  })
  if (!rate.allowed) {
    return NextResponse.json({ ok: false }, { status: 429 })
  }

  let body: ErrorReport
  try {
    body = (await request.json()) as ErrorReport
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 })
  }

  const safeMessage = (body.message || 'Unknown error').slice(0, 1000)
  const safeName = (body.name || 'Error').slice(0, 200)

  logger.error('Client error report', {
    clientError: true,
    message: safeMessage,
    name: safeName,
    digest: body.digest?.slice(0, 100),
    url: body.url?.slice(0, 500),
    userAgent: body.userAgent?.slice(0, 300),
    ip,
  })

  return NextResponse.json({ ok: true })
}
