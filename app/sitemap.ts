import type { MetadataRoute } from 'next'

import { alternatesLanguagesForPath } from '@/lib/locale-href'

/** Required for `output: export` (Capacitor / static hosting). */
export const dynamic = 'force-static'

export default function sitemap(): MetadataRoute.Sitemap {
  const paths = ['/', '/login', '/privacy', '/terms', '/marketing', '/offline']

  const entries: MetadataRoute.Sitemap = []
  for (const path of paths) {
    const { canonical, languages } = alternatesLanguagesForPath(path)
    entries.push({
      url: canonical,
      lastModified: new Date(),
      changeFrequency: path === '/' || path === '/marketing' ? 'daily' : path === '/login' ? 'monthly' : 'yearly',
      priority: path === '/' || path === '/marketing' ? 1 : 0.6,
      alternates: {
        languages,
      },
    })
  }
  return entries
}
