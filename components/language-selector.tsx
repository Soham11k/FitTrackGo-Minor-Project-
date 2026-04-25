"use client"

import { useLocale } from "@/components/locale-provider"
import { SUPPORTED_LOCALES, type Locale } from "@/lib/i18n"
import { LOCALE_NAMES } from "@/lib/translations"
import { Globe } from "lucide-react"
import { toast } from "sonner"

export function LanguageSelector() {
  const { locale, setLocale, t } = useLocale()

  return (
    <div className="flex items-center justify-between gap-3 py-3 border-b border-border">
      <div className="flex items-center gap-2">
        <Globe className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm text-foreground">{t("settings.language")}</span>
      </div>
      <div className="flex gap-1.5" role="group" aria-label="Language">
        {SUPPORTED_LOCALES.map((loc: Locale) => (
          <button
            key={loc}
            type="button"
            onClick={() => {
              setLocale(loc)
              toast.success(LOCALE_NAMES[loc])
            }}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
              locale === loc
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground hover:text-foreground"
            }`}
            aria-pressed={locale === loc}
          >
            {loc.toUpperCase()}
          </button>
        ))}
      </div>
    </div>
  )
}
