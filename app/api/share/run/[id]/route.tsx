import { ImageResponse } from 'next/og'
import { createServiceRoleClient } from '@/lib/supabase/service-role'

export const runtime = 'edge'

const BEBAS_WOFF2 =
  'https://fonts.gstatic.com/s/bebasneue/v16/JTUSjIg69CK48gW7PXooxWtrzAbj.woff2'

async function loadBebasFont(): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(BEBAS_WOFF2, {
      headers: { Accept: '*/*' },
    })
    if (!res.ok) return null
    return await res.arrayBuffer()
  } catch {
    return null
  }
}

function formatSecs(sec: number): string {
  const t = Math.max(0, Math.floor(sec))
  const h = Math.floor(t / 3600)
  const m = Math.floor((t % 3600) / 60)
  const s = t % 60
  const two = (x: number) => String(x).padStart(2, '0')
  if (h > 0) return `${h}:${two(m)}:${two(s)}`
  return `${m}:${two(s)}`
}

/**
 * Lightweight share preview image for a saved run UUID.
 *
 * ⚠️ This route is reachable by opaque IDs only; omit user identifiers from the PNG.
 */
export async function GET(
  _: Request,
  ctx: { params: Promise<{ id: string }> }
): Promise<ImageResponse | Response> {
  if (process.env.FITTRACK_DISABLE_PUBLIC_RUN_SHARE === '1') {
    return Response.json({ error: 'sharing_disabled' }, { status: 404 })
  }
  const admin = createServiceRoleClient()
  const { id } = await ctx.params
  if (!admin || !id) {
    return Response.json({ error: 'Unavailable' }, { status: 503 })
  }

  const { data, error } = await admin
    .from('runs')
    .select('distance, duration, pace, calories')
    .eq('id', id)
    .maybeSingle()

  if (error || !data) {
    return Response.json({ error: 'not_found' }, { status: 404 })
  }

  const distance = typeof data.distance === 'string' ? parseFloat(data.distance) : Number(data.distance ?? 0)
  const dur = typeof data.duration === 'number' ? data.duration : 0
  const pace = typeof data.pace === 'string' ? data.pace : '—'

  const bebas = await loadBebasFont()
  const fonts = bebas
    ? [{ name: 'Bebas Neue', data: bebas, style: 'normal' as const, weight: 400 as const }]
    : []

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          backgroundColor: '#0a0a0a',
          color: '#fafafa',
          padding: '64px',
          border: '2px solid rgba(34,197,94,0.65)',
          fontFamily: '"Bebas Neue", ui-sans-serif, system-ui',
        }}
      >
        <div style={{ fontSize: 28, opacity: 0.78 }}>FITTRACK GO · SHARED RUN</div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 16 }}>
          <div style={{ fontSize: 96, letterSpacing: -2, textTransform: 'uppercase', lineHeight: 1 }}>
            {Number.isFinite(distance) ? `${distance.toFixed(2)} KM` : '—'}
          </div>
          <div style={{ fontFamily: 'ui-sans-serif, system-ui', fontSize: 40, opacity: 0.88 }}>
            {formatSecs(dur)} · {pace}/km · {typeof data.calories === 'number' ? `${Math.round(data.calories)} kcal` : ''}
          </div>
        </div>
        <div style={{ fontSize: 34, letterSpacing: 2 }}>FITTRACK GO · TRAIN WITH PROOF</div>
      </div>
    ),
    { width: 1200, height: 630, fonts }
  )
}
