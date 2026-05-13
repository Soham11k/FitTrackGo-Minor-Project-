/**
 * Branded share-card PNG composition (canvas-only, no html-to-image).
 */

import type { Locale } from "./i18n"
import { DEFAULT_LOCALE, formatDurationSec } from "./i18n"

/** Google-served Bebas Neue woff2 (matches next/font/google). */
const BEBAS_NEUE_WOFF2 =
  "https://fonts.gstatic.com/s/bebasneue/v16/JTUSjIg69CK48gW7PXooxWtrzAbj.woff2"

let brandFontsLoad: Promise<boolean> | null = null

/**
 * Loads Bebas Neue for canvas `fillText`; cached at module scope.
 * @returns whether Bebas Neue is available (false → use system-ui).
 */
export async function loadBrandFonts(): Promise<boolean> {
  if (typeof document === "undefined") return false
  if (!brandFontsLoad) {
    brandFontsLoad = (async () => {
      try {
        const face = new FontFace(
          "Bebas Neue",
          `url(${BEBAS_NEUE_WOFF2}) format("woff2")`,
          { weight: "400", style: "normal" },
        )
        await face.load()
        document.fonts.add(face)
        await document.fonts.ready.catch(() => undefined)
        return document.fonts.check("400 16px Bebas Neue")
      } catch {
        return false
      }
    })()
  }
  return brandFontsLoad
}

export function heroFont(weight: number, px: number, hasBrand: boolean): string {
  return `${weight} ${px}px ${hasBrand ? "Bebas Neue, system-ui" : "system-ui"}`
}

function resolveCssColor(cssVar: string, fallback: string): string {
  if (typeof document === "undefined") return fallback
  const el = document.createElement("div")
  el.style.color = `var(${cssVar})`
  el.style.position = "absolute"
  el.style.visibility = "hidden"
  el.style.pointerEvents = "none"
  document.body.appendChild(el)
  const c = getComputedStyle(el).color
  document.body.removeChild(el)
  return c && c !== "rgba(0, 0, 0, 0)" ? c : fallback
}

export type RunSharePayload = {
  distanceKm: number
  durationSec: number
  pacePerKm: string
  dateLabel: string
  path: [number, number][]
  /** When true, draws PB ribbon on PNG. */
  isPb?: boolean
}

export type CoachSharePayload = {
  exercise: string
  reps: number
  score: number
  effectiveReps: number
  repScores: number[]
  verifiedMovement: boolean
  faceVerifiedSession: boolean
  /** Top textual faults rendered under the recap on PNG share cards */
  topFaults?: string[]
}

function pathToCanvasPath(
  path: [number, number][],
  inset: number,
  w: number,
  h: number,
): { d: string; minLat: number; dLat: number; minLon: number; dLon: number } | null {
  if (path.length < 2) return null
  const lats = path.map((p) => p[0])
  const lons = path.map((p) => p[1])
  const minLat = Math.min(...lats)
  const maxLat = Math.max(...lats)
  const minLon = Math.min(...lons)
  const maxLon = Math.max(...lons)
  const dLat = maxLat - minLat || 1e-6
  const dLon = maxLon - minLon || 1e-6
  const vbw = w - inset * 2
  const vbh = h - inset * 2
  const d = path
    .map(([lat, lon], i) => {
      const x = inset + ((lon - minLon) / dLon) * vbw
      const y = inset + (1 - (lat - minLat) / dLat) * vbh
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join("")
  return { d, minLat, dLat, minLon, dLon }
}

export type ShareCardComposeOpts =
  | { kind: "run"; payload: RunSharePayload }
  | { kind: "coach"; payload: CoachSharePayload }

export type ShareCardLocaleOpts = {
  locale?: Locale
  distanceUnit?: "km" | "mi"
}

/** Single entry point for branded PNG share cards (run + coach; extend for achievements). */
export async function composeShareCard(
  opts: ShareCardComposeOpts & ShareCardLocaleOpts,
): Promise<File | null> {
  if (opts.kind === "run") {
    return composeRunShareFile(opts.payload, {
      locale: opts.locale ?? DEFAULT_LOCALE,
      distanceUnit: opts.distanceUnit ?? "km",
    })
  }
  return composeCoachShareFile(opts.payload)
}

export function drawPbSticker(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  label: string,
  stroke: string,
  fill = "rgba(250,204,21,0.22)",
): void {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(-0.12)
  ctx.font = "bold 26px Bebas Neue, system-ui"
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  const padX = 18
  const w = ctx.measureText(label).width + padX * 2
  const h = 40
  const rx = 20
  const left = -w / 2
  const top = -h / 2
  ctx.strokeStyle = stroke
  ctx.lineWidth = 2
  ctx.fillStyle = fill
  ctx.beginPath()
  if (typeof ctx.roundRect === "function") ctx.roundRect(left, top, w, h, rx)
  else ctx.rect(left, top, w, h)
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = "#fafafa"
  ctx.fillText(label, 0, 2)
  ctx.restore()
}

function paceToSec(p: string): number {
  const m = /^(\d+):(\d{1,2})$/.exec(String(p).trim())
  if (!m) return Infinity
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10)
}

/**
 * Side-by-side 1080² share comparing two runs — vertical bars (taller highlights the edge).
 */
export async function composeRunVersusShareFile(
  you: RunSharePayload,
  opponent: RunSharePayload,
  composeOpts?: ShareCardLocaleOpts,
): Promise<File | null> {
  if (typeof document === "undefined") return null
  await loadBrandFonts()
  const hasBrand = typeof document !== "undefined" && document.fonts.check("400 24px Bebas Neue")
  const locale = composeOpts?.locale ?? DEFAULT_LOCALE
  const unit = composeOpts?.distanceUnit === "mi" ? "mi" : "km"

  const W = 1080
  const accent = resolveCssColor("--primary", "rgb(34,197,94)")
  const stage = resolveCssColor("--surface-stage-fg", "rgb(250,250,250)")
  const lose = "rgba(255,255,255,0.22)"

  const canvas = document.createElement("canvas")
  canvas.width = W
  canvas.height = W
  const ctx = canvas.getContext("2d")
  if (!ctx) return null

  ctx.fillStyle = "rgb(12,12,12)"
  ctx.fillRect(0, 0, W, W)

  ctx.strokeStyle = accent
  ctx.lineWidth = 3
  ctx.strokeRect(28, 28, W - 56, W - 56)

  ctx.fillStyle = accent
  ctx.font = `${hasBrand ? "bold 52px Bebas Neue, system-ui" : "bold 52px system-ui"}`
  const title = "VERSUS RUN"
  ctx.fillText(title, W / 2 - ctx.measureText(title).width / 2, 116)

  const youDist = Number(you.distanceKm) || 0
  const oppDist = Number(opponent.distanceKm) || 0
  const distWin = youDist > oppDist ? "you" : youDist < oppDist ? "them" : "tie"

  const youPaceSec = paceToSec(you.pacePerKm)
  const oppPaceSec = paceToSec(opponent.pacePerKm)
  let paceWin: "you" | "them" | "tie" = "tie"
  const yInf = youPaceSec === Infinity
  const oInf = oppPaceSec === Infinity
  if (yInf && oInf) paceWin = "tie"
  else if (yInf) paceWin = "them"
  else if (oInf) paceWin = "you"
  else if (youPaceSec < oppPaceSec) paceWin = "you"
  else if (youPaceSec > oppPaceSec) paceWin = "them"

  const youTime = Number(you.durationSec) || 0
  const oppTime = Number(opponent.durationSec) || 0
  const timeWin =
    youTime === oppTime ? "tie" : youTime < oppTime ? "you" : "them"

  const cx = W / 2
  const labelY = 200
  ctx.font = `${hasBrand ? "600 44px Bebas Neue, system-ui" : "600 44px system-ui"}`
  ctx.fillStyle = "rgba(255,255,255,0.72)"
  const youLab = "YOU"
  const themLab = "THEM"
  ctx.fillText(youLab, cx * 0.5 - ctx.measureText(youLab).width / 2 + 24, labelY)
  ctx.fillText(themLab, cx * 1.5 - ctx.measureText(themLab).width / 2 - 24, labelY)

  const nf = new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  const youDistLbl = nf.format(unit === "mi" ? youDist * 0.621371 : youDist)
  const oppDistLbl = nf.format(unit === "mi" ? oppDist * 0.621371 : oppDist)

  ctx.font = heroFont(800, 88, hasBrand)
  ctx.fillStyle = stage
  ctx.textAlign = "center"
  ctx.fillText(`${youDistLbl}`, cx / 2, 274)
  ctx.fillText(`${oppDistLbl}`, cx + cx / 2, 274)
  ctx.font = `${hasBrand ? "500 34px Bebas Neue, system-ui" : "500 34px system-ui"}`
  ctx.fillStyle = "rgba(255,255,255,0.52)"
  const u = unit === "mi" ? "mi" : "km"
  ctx.fillText(u, cx / 2, 316)
  ctx.fillText(u, cx + cx / 2, 316)

  const barBottom = W - 64
  const barMax = 150
  const barW = 44
  const lx = cx / 2
  const rx = cx + cx / 2
  ctx.textAlign = "left"

  type RowCfg = {
    caption: string
    youPct: number
    oppPct: number
    youWin: boolean
    oppWin: boolean
  }

  function normHigher(dA: number, dB: number) {
    const m = Math.max(dA, dB, 1e-6)
    return { a: dA / m, b: dB / m }
  }

  /** Lower pace seconds wins — bar height favors faster runner. */
  function normLower(a: number, b: number) {
    if (!Number.isFinite(a) || !Number.isFinite(b)) {
      const fa = Number.isFinite(a)
      const fb = Number.isFinite(b)
      if (fa && !fb) return { a: 1, b: 0.2 }
      if (fb && !fa) return { a: 0.2, b: 1 }
      return { a: 0.45, b: 0.45 }
    }
    const m = Math.max(a, b, 1)
    return { a: 1 - a / m + 0.08, b: 1 - b / m + 0.08 }
  }

  const dP = normHigher(youDist, oppDist)
  const pP = normLower(youPaceSec === Infinity ? NaN : youPaceSec, oppPaceSec === Infinity ? NaN : oppPaceSec)
  const tP = normLower(youTime || 1, oppTime || 1)

  const rows: RowCfg[] = [
    {
      caption: `Distance (${u})`,
      youPct: dP.a,
      oppPct: dP.b,
      youWin: distWin === "you",
      oppWin: distWin === "them",
    },
    {
      caption: "Pace (/km)",
      youPct: pP.a,
      oppPct: pP.b,
      youWin: paceWin === "you",
      oppWin: paceWin === "them",
    },
    {
      caption: "Time",
      youPct: tP.a,
      oppPct: tP.b,
      youWin: timeWin === "you",
      oppWin: timeWin === "them",
    },
  ]

  rows.forEach((row, i) => {
    const baseline = barBottom - i * 188
    ctx.font = `${hasBrand ? "600 36px Bebas Neue, system-ui" : "600 36px system-ui"}`
    ctx.fillStyle = "rgba(255,255,255,0.55)"
    ctx.textAlign = "center"
    ctx.fillText(row.caption, cx, baseline - barMax - 36)

    const hL = Math.max(18, row.youPct * barMax)
    const hR = Math.max(18, row.oppPct * barMax)
    ctx.fillStyle = row.youWin ? accent : lose
    ctx.fillRect(lx - barW / 2, baseline - hL, barW, hL)
    ctx.fillStyle = row.oppWin ? accent : lose
    ctx.fillRect(rx - barW / 2, baseline - hR, barW, hR)

    ctx.strokeStyle = "rgba(255,255,255,0.08)"
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(lx - barW / 2 - 36, baseline)
    ctx.lineTo(rx + barW / 2 + 36, baseline)
    ctx.stroke()
  })

  ctx.textAlign = "left"
  ctx.fillStyle = accent
  ctx.font = `${hasBrand ? "bold 44px Bebas Neue, system-ui" : "bold 44px system-ui"}`
  const foot = "FITTRACK GO · VERSUS"
  ctx.fillText(foot, W / 2 - ctx.measureText(foot).width / 2, W - 72)

  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          resolve(null)
          return
        }
        resolve(new File([blob], `fittrack-run-vs-${Date.now()}.png`, { type: "image/png" }))
      },
      "image/png",
      0.95,
    )
  })
}

export async function composeRunShareFile(
  payload: RunSharePayload,
  composeOpts?: ShareCardLocaleOpts,
): Promise<File | null> {
  if (typeof document === "undefined") return null
  await loadBrandFonts()
  const hasBrand = typeof document !== "undefined" && document.fonts.check("400 24px Bebas Neue")
  const locale = composeOpts?.locale ?? DEFAULT_LOCALE
  const unit = composeOpts?.distanceUnit === "mi" ? "mi" : "km"
  const accent = resolveCssColor("--primary", "rgb(34,197,94)")
  const stage = resolveCssColor("--surface-stage-fg", "rgb(250,250,250)")
  const W = 1080
  const H = 1920
  const canvas = document.createElement("canvas")
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext("2d")
  if (!ctx) return null
  ctx.fillStyle = "rgb(18,18,18)"
  ctx.fillRect(0, 0, W, H)
  ctx.strokeStyle = "rgba(255,255,255,0.12)"
  ctx.lineWidth = 2
  ctx.strokeRect(24, 24, W - 48, H - 48)

  const mapH = 720
  const route = pathToCanvasPath(payload.path, 48, W - 96, mapH - 96)
  if (route?.d) {
    ctx.strokeStyle = accent
    ctx.lineWidth = 6
    ctx.lineJoin = "round"
    ctx.lineCap = "round"
    const p = new Path2D(route.d)
    ctx.save()
    ctx.translate(48, 120)
    ctx.stroke(p)
    ctx.restore()
  } else {
    ctx.fillStyle = "rgba(255,255,255,0.5)"
    ctx.font = heroFont(500, 42, hasBrand)
    ctx.fillText("FitTrack Go", 80, mapH / 2 + 120)
  }

  const distHero =
    unit === "mi"
      ? new Intl.NumberFormat(locale, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(payload.distanceKm * 0.621371)
      : new Intl.NumberFormat(locale, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(payload.distanceKm)
  const timeStr = formatDurationSec(payload.durationSec, locale)
  const unitSuffix = unit === "mi" ? "mi" : "km"

  ctx.fillStyle = stage
  ctx.font = heroFont(800, 120, hasBrand)
  ctx.letterSpacing = "-2px"
  ctx.fillText(distHero, 72, mapH + 200)
  ctx.font = `${hasBrand ? "600 52px Bebas Neue, system-ui" : "600 52px system-ui"}`
  ctx.letterSpacing = "0"
  ctx.fillStyle = "rgba(255,255,255,0.7)"
  ctx.fillText(`${unitSuffix} · ${timeStr} · ${payload.pacePerKm}/${unitSuffix}`, 72, mapH + 280)
  ctx.font = `${hasBrand ? "500 44px Bebas Neue, system-ui" : "500 44px system-ui"}`
  ctx.fillText(payload.dateLabel, 72, mapH + 360)

  if (payload.isPb) {
    drawPbSticker(ctx, W / 2, mapH + 160, "PERSONAL BEST", "rgba(250,204,21,0.85)")
  }

  ctx.fillStyle = accent
  ctx.font = `${hasBrand ? "bold 52px Bebas Neue, system-ui" : "bold 52px system-ui"}`
  ctx.fillText("FITTRACK GO", 72, H - 120)

  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          resolve(null)
          return
        }
        resolve(new File([blob], `fittrack-run-${Date.now()}.png`, { type: "image/png" }))
      },
      "image/png",
      0.95,
    )
  })
}

export async function composeCoachShareFile(payload: CoachSharePayload): Promise<File | null> {
  if (typeof document === "undefined") return null
  await loadBrandFonts()
  const hasBrand = typeof document !== "undefined" && document.fonts.check("400 24px Bebas Neue")
  const accent = resolveCssColor("--primary", "rgb(34,197,94)")
  const W = 1080
  const H = 1920
  const canvas = document.createElement("canvas")
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext("2d")
  if (!ctx) return null
  ctx.fillStyle = "rgb(18,18,18)"
  ctx.fillRect(0, 0, W, H)
  ctx.strokeStyle = "rgba(255,255,255,0.12)"
  ctx.lineWidth = 2
  ctx.strokeRect(24, 24, W - 48, H - 48)

  ctx.fillStyle = "#fafafa"
  ctx.font = heroFont(800, 220, hasBrand)
  ctx.fillText(`${payload.score}%`, 72, 420)
  ctx.font = `${hasBrand ? "600 48px Bebas Neue, system-ui" : "600 48px system-ui"}`
  ctx.fillStyle = "rgba(255,255,255,0.75)"
  ctx.fillText("FORM SCORE", 72, 500)
  ctx.fillStyle = "#fff"
  ctx.font = `${hasBrand ? "500 54px Bebas Neue, system-ui" : "500 54px system-ui"}`
  ctx.fillText(payload.exercise, 72, 620)
  ctx.font = `${hasBrand ? "44px Bebas Neue, system-ui" : "44px system-ui"}`
  ctx.fillStyle = "rgba(255,255,255,0.8)"
  ctx.fillText(`${payload.reps} reps · ${payload.effectiveReps.toFixed(1)} effective`, 72, 710)
  const flags = [payload.verifiedMovement ? "Verified movement" : null, payload.faceVerifiedSession ? "Face verified" : null]
    .filter(Boolean)
    .join(" · ")
  if (flags) ctx.fillText(flags, 72, 780)

  let faultY = 840
  if (payload.topFaults?.length) {
    ctx.fillStyle = "#fecaca"
    ctx.font = `${hasBrand ? "500 38px Bebas Neue, system-ui" : "500 38px system-ui"}`
    payload.topFaults.slice(0, 3).forEach((fault, idx) => {
      const line = fault.length > 56 ? `${fault.slice(0, 54)}…` : fault
      ctx.fillText(`• ${line}`, 72, faultY + idx * 48)
    })
    faultY += payload.topFaults.length * 48 + 20
    ctx.fillStyle = "rgba(255,255,255,0.8)"
  }

  const raw = [...payload.repScores]
  const maxBar = Math.max(...raw, 1)
  const barZoneY = H - 640
  const barW = (W - 160) / Math.max(raw.length, 8)
  raw.slice(0, 36).forEach((s, i) => {
    const bh = (s / maxBar) * 420
    ctx.fillStyle = accent
    ctx.fillRect(80 + i * barW, barZoneY + 420 - bh, Math.max(4, barW - 6), bh)
  })

  ctx.fillStyle = accent
  ctx.font = `${hasBrand ? "bold 52px Bebas Neue, system-ui" : "bold 52px system-ui"}`
  ctx.fillText("FITTRACK GO · COACH", 72, H - 120)

  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          resolve(null)
          return
        }
        resolve(new File([blob], `fittrack-coach-${Date.now()}.png`, { type: "image/png" }))
      },
      "image/png",
      0.95,
    )
  })
}
