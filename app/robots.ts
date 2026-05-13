import type { MetadataRoute } from 'next'
import { APP_BASE_URL } from '@/lib/locale-href'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: ['/'],
      disallow: ['/api/', '/cron/'],
    },
    host: (() => {
      try {
        return new URL(APP_BASE_URL).host
      } catch {
        return undefined
      }
    })(),
    sitemap: `${APP_BASE_URL}/sitemap.xml`,
  }
}
