import { NextResponse } from 'next/server'

export const dynamic = 'force-static'

function notFound() {
  return NextResponse.json({ error: 'Not found', note: 'export-stub' }, { status: 404 })
}

export const GET = notFound
export const POST = notFound
export const PUT = notFound
export const PATCH = notFound
export const DELETE = notFound
export const OPTIONS = notFound
