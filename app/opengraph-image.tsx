import { ImageResponse } from 'next/og'
import siteData from '@/data/site.json'

/** Branded OG image — stage runway + frame (aligned with lib/share-card run layout). */

export const alt = siteData.appName
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OpenGraphImage() {
  const title = 'FitTrack Go'
  const tagline = siteData.tagline ?? 'Train with proof.'

  return new ImageResponse(
    (
      <div
        style={{
          width: size.width,
          height: size.height,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#121212',
          position: 'relative',
          fontFamily: 'ui-sans-serif, system-ui, sans-serif',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 24,
            border: '4px solid rgba(255, 255, 255, 0.12)',
            boxSizing: 'border-box',
          }}
        />
        <span
          style={{
            fontSize: 94,
            fontWeight: 800,
            letterSpacing: '-0.03em',
            color: '#fafafa',
          }}
        >
          {title}
        </span>
        <span
          style={{
            marginTop: 18,
            fontSize: 34,
            fontWeight: 600,
            color: '#22c55e',
          }}
        >
          {tagline}
        </span>
        <span
          style={{
            marginTop: 28,
            fontSize: 22,
            fontWeight: 500,
            color: 'rgba(250, 250, 250, 0.55)',
          }}
        >
          Track runs · Coach · Arena
        </span>
      </div>
    ),
    { ...size }
  )
}
