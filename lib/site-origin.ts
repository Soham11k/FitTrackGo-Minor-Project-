/** Absolute site origin for metadata / OG images (falls back empty on dev). */
export function publicSiteOrigin(): string {
  const nu = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  if (nu?.startsWith("http")) return nu.replace(/\/$/, "")
  const v = process.env.VERCEL_URL?.trim()
  if (v) return `https://${v.replace(/\/$/, "")}`
  return ""
}
