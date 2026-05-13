import type { Locale } from '@/lib/i18n'
import { SUPPORTED_LOCALES } from '@/lib/i18n'

const RAW = process.env.NEXT_PUBLIC_APP_URL || 'https://fittrackgo.com'
export const APP_BASE_URL = RAW.replace(/\/$/, '')

/** Public absolute URL per locale (`en` canonical without query). */
export function hrefForLocale(locale: Locale, path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`
  if (locale === 'en') {
    return p === '/' ? `${APP_BASE_URL}/` : `${APP_BASE_URL}${p}`
  }
  const joiner = p.includes('?') ? '&' : '?'
  return `${APP_BASE_URL}${p}${joiner}ft_lang=${locale}`
}

export function alternatesLanguagesForPath(path: string, canonicalLocale: Locale = 'en'): { canonical: string; languages: Record<string, string> } {
  const p = path.startsWith('/') ? path : `/${path}`
  const canonical = hrefForLocale(canonicalLocale, p)
  const languages: Record<string, string> = {}
  for (const loc of SUPPORTED_LOCALES) {
    languages[loc] = hrefForLocale(loc, p)
  }
  languages['x-default'] = canonical
  return { canonical, languages }
}
