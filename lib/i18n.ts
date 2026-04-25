export const SUPPORTED_LOCALES = ['en', 'es', 'fr', 'de', 'hi'] as const
export type Locale = (typeof SUPPORTED_LOCALES)[number]

export const DEFAULT_LOCALE: Locale = 'en'

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
