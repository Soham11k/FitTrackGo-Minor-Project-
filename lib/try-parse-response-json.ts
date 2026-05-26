/** Parse JSON from a fetch Response without throwing on empty or invalid bodies. */
export async function tryParseResponseJson<T>(res: Response): Promise<T | null> {
  try {
    const text = await res.text()
    if (!text.trim()) return null
    return JSON.parse(text) as T
  } catch {
    return null
  }
}
