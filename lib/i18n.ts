export const SUPPORTED_LOCALES = ['en', 'es', 'fr', 'de', 'hi', 'ar'] as const
export type Locale = (typeof SUPPORTED_LOCALES)[number]

export const DEFAULT_LOCALE: Locale = 'en'

const RTL_LANGS = new Set<Locale>(['ar'])

/** Document direction for `lang`/`dir` plumbing (PR B2 RTL). */
export function getDir(locale: Locale): 'ltr' | 'rtl' {
  return RTL_LANGS.has(locale) ? 'rtl' : 'ltr'
}

/** Open Graph `locale` tag (underscore form). */
export function openGraphLocaleTag(locale: Locale): string {
  const map: Record<Locale, string> = {
    en: 'en_US',
    es: 'es_ES',
    fr: 'fr_FR',
    de: 'de_DE',
    hi: 'hi_IN',
    ar: 'ar_SA',
  }
  return map[locale]
}

/** Optional secondary locales for `openGraph.alternateLocale`. */
export function openGraphAlternateLocales(locale: Locale): string[] {
  return SUPPORTED_LOCALES.filter((l) => l !== locale).map(openGraphLocaleTag)
}

export function normalizeLocale(input: string | null | undefined): Locale {
  if (!input) return DEFAULT_LOCALE
  const lang = input.toLowerCase().split('-')[0]
  if (SUPPORTED_LOCALES.includes(lang as Locale)) {
    return lang as Locale
  }
  return DEFAULT_LOCALE
}

export function getPreferredLocaleFromHeader(acceptLanguage: string | null): Locale {
  if (!acceptLanguage) return DEFAULT_LOCALE
  const first = acceptLanguage.split(',')[0]
  return normalizeLocale(first)
}

export function formatDistanceKm(distanceKm: number, locale: Locale, unit: 'km' | 'mi') {
  if (unit === 'mi') {
    const miles = distanceKm * 0.621371
    return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(miles)} mi`
  }
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(distanceKm)} km`
}

export function formatNumber(value: number, locale: Locale, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(locale, options).format(value)
}

/** Wall-clock duration (sport timers), localized digit shaping. */
export function formatDurationSec(totalSeconds: number, locale: Locale): string {
  const t = Math.max(0, Math.floor(totalSeconds))
  const hrs = Math.floor(t / 3600)
  const m = Math.floor((t % 3600) / 60)
  const sec = t % 60
  const two = new Intl.NumberFormat(locale, { minimumIntegerDigits: 2, maximumFractionDigits: 0 })
  if (hrs > 0) {
    return `${new Intl.NumberFormat(locale).format(hrs)}:${two.format(m)}:${two.format(sec)}`
  }
  return `${two.format(m)}:${two.format(sec)}`
}

/** Relative phrases — use for feeds / “completed X ago”. */
export function formatRelativeTime(target: Date, locale: Locale, nowInput: Date = new Date()): string {
  const diffSec = Math.round((target.getTime() - nowInput.getTime()) / 1000)
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  const abs = Math.abs(diffSec)
  if (abs < 60) return rtf.format(diffSec, 'second')
  const diffMin = Math.round(diffSec / 60)
  if (Math.abs(diffMin) < 60) return rtf.format(diffMin, 'minute')
  const diffHr = Math.round(diffMin / 60)
  if (Math.abs(diffHr) < 24) return rtf.format(diffHr, 'hour')
  const diffDay = Math.round(diffHr / 24)
  if (Math.abs(diffDay) < 30) return rtf.format(diffDay, 'day')
  const diffMonth = Math.round(diffDay / 30)
  if (Math.abs(diffMonth) < 12) return rtf.format(diffMonth, 'month')
  const diffYear = Math.round(diffDay / 365)
  return rtf.format(diffYear, 'year')
}

/** Attaches localized-friendly pace string with distance unit suffix (caller formats min:sec). */
export function formatPaceWithUnit(paceMinuteFragment: string, unit: 'km' | 'mi'): string {
  return `${paceMinuteFragment}/${unit === 'mi' ? 'mi' : 'km'}`
}

/** Pace as minutes per km (decimal), renders m:ss/KM or MI-adjusted numeric distance pace. */
export function formatPaceMinPerKm(paceMinutesPerKm: number, locale: Locale, unit: 'km' | 'mi'): string {
  if (!Number.isFinite(paceMinutesPerKm) || paceMinutesPerKm <= 0) return '—'
  const scaled = unit === 'mi' ? paceMinutesPerKm * 1.609344 : paceMinutesPerKm
  const m = Math.floor(scaled)
  const s = Math.min(59, Math.round((scaled - m) * 60))
  const nf2 = new Intl.NumberFormat(locale, { minimumIntegerDigits: 2, maximumFractionDigits: 0 })
  return `${new Intl.NumberFormat(locale).format(m)}:${nf2.format(s)}/${unit === 'mi' ? 'mi' : 'km'}`
}
