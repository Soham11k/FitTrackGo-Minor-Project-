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
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 108,
            height: 108,
            borderRadius: 28,
            border: "2px solid rgba(255,255,255,0.16)",
            background: "rgba(10,10,10,0.7)",
            marginBottom: 18,
          }}
        >
          <svg width="74" height="74" viewBox="0 0 80 80" fill="none">
            <path d="M 40 28 A 12 12 0 1 1 34 50" stroke="rgba(250,250,250,0.12)" strokeWidth="2" strokeLinecap="round" />
            <path d="M 40 20 A 20 20 0 1 1 26 54" stroke="rgba(250,250,250,0.18)" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M 40 12 A 28 28 0 1 1 18 56" stroke="#22c55e" strokeWidth="4.5" strokeLinecap="round" />
            <circle cx="18" cy="56" r="4.5" fill="#22c55e" />
          </svg>
        </div>
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
