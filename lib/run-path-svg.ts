/** Normalized GPS polyline to SVG path `d` for previews (viewBox 0 0 100 100). */
export function pathToSvgD(path: [number, number][], inset = 8): string {
  if (path.length < 2) return ""
  const lats = path.map((p) => p[0])
  const lons = path.map((p) => p[1])
  const minLat = Math.min(...lats)
  const maxLat = Math.max(...lats)
  const minLon = Math.min(...lons)
  const maxLon = Math.max(...lons)
  const dLat = maxLat - minLat || 1e-6
  const dLon = maxLon - minLon || 1e-6
  const vb = 100 - inset * 2
  return path
    .map(([lat, lon], i) => {
      const x = inset + ((lon - minLon) / dLon) * vb
      const y = inset + (1 - (lat - minLat) / dLat) * vb
      return `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`
    })
    .join("")
}
