import type { Locale } from './i18n'

import en from '../messages/en.json'
import es from '../messages/es.json'
import fr from '../messages/fr.json'
import de from '../messages/de.json'
import hi from '../messages/hi.json'
import ar from '../messages/ar.json'

/** Flat message map per locale — round-trip compatible with translators. */
const translations: Record<Locale, Record<string, string>> = {
  en,
  es,
  fr,
  de,
  hi,
  ar,
}

export function t(key: string, locale: Locale): string {
  return translations[locale]?.[key] ?? translations.en[key] ?? key
}

export const LOCALE_NAMES: Record<Locale, string> = {
  en: 'English',
  es: 'Español',
  fr: 'Français',
  de: 'Deutsch',
  hi: 'हिन्दी',
  ar: 'العربية',
}
