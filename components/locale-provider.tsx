"use client"

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react"
import type { Locale } from "@/lib/i18n"
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, getDir } from "@/lib/i18n"
import { t as translate } from "@/lib/translations"

type LocaleContextType = {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: string) => string
}

const LocaleContext = createContext<LocaleContextType>({
  locale: DEFAULT_LOCALE,
  setLocale: () => {},
  t: (key) => key,
})

const STORAGE_KEY = "fittrackgo_locale"

function getStoredLocale(): Locale {
  if (typeof window === "undefined") return DEFAULT_LOCALE
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored && SUPPORTED_LOCALES.includes(stored as Locale)) {
      return stored as Locale
    }
  } catch {}
  return DEFAULT_LOCALE
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(getStoredLocale)

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale)
    try {
      localStorage.setItem(STORAGE_KEY, newLocale)
      document.documentElement.lang = newLocale
      document.documentElement.dir = getDir(newLocale)
    } catch {}
  }, [])

  const t = useCallback(
    (key: string) => translate(key, locale),
    [locale]
  )

  useEffect(() => {
    try {
      document.documentElement.lang = locale
      document.documentElement.dir = getDir(locale)
    } catch {}
  }, [locale])

  return (
    <LocaleContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LocaleContext.Provider>
  )
}

export function useLocale() {
  return useContext(LocaleContext)
}
