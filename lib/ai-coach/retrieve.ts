import { buildCoachCorpus, type CoachChunk } from "./corpus"
import { isOpenAIConfigured } from "./openai-fetch"

/** Stops over-weighting “the / a / to …” in the user question. */
const STOP = new Set(
  "a an the to of in on for and or is are was be as at it we you your my our if so do does did with from by not no yes how what why when where which this that these those".split(" ")
)

function tokenize(s: string): string[] {
  const w = s.toLowerCase().match(/[a-z0-9_]+/g) ?? []
  return w.filter((x) => x.length > 1 && !STOP.has(x))
}

/**
 * Fast RAG over the in-app corpus: word overlap with the user query, plus
 * strong boost for the current exercise. No embedding API — avoids 5–20s
 * cold-start when we used to batch-embed the whole corpus on first request.
 */
function retrieveLexical(opts: { userQuery: string; exerciseId: string; topK: number }): CoachChunk[] {
  const corpus = buildCoachCorpus()
  const qTokens = new Set(tokenize(opts.userQuery))
  const exerciseId = opts.exerciseId

  if (qTokens.size === 0) {
    const picked: CoachChunk[] = []
    for (const c of corpus) {
      if (c.exerciseId === exerciseId) picked.push(c)
    }
    for (const c of corpus) {
      if (c.exerciseId === "general" && !picked.includes(c)) picked.push(c)
    }
    return picked.slice(0, opts.topK)
  }

  const scored: { c: CoachChunk; s: number }[] = []
  for (const c of corpus) {
    const text = c.text.toLowerCase()
    let s = 0
    for (const t of qTokens) {
      if (text.includes(t)) s += 1.2
    }
    if (c.exerciseId === exerciseId) s += 8
    if (c.exerciseId === "general") s += 1.5
    // Prefer chunks that use query words; dedupe with overlap already handles it
    for (const t of qTokens) {
      if (c.id.toLowerCase().includes(t)) s += 0.5
    }
    scored.push({ c, s })
  }
  scored.sort((a, b) => b.s - a.s)
  const best = scored[0]?.s ?? 0
  if (best === 0) {
    // No word overlap: still send this exercise’s tips + general policy lines
    return corpus
      .filter((c) => c.exerciseId === exerciseId)
      .concat(corpus.filter((c) => c.exerciseId === "general"))
      .slice(0, opts.topK)
  }
  return scored.slice(0, opts.topK).map((x) => x.c)
}

export async function retrieveRelevantChunks(opts: {
  userQuery: string
  exerciseId: string
  topK: number
}): Promise<CoachChunk[]> {
  if (!isOpenAIConfigured() || !opts.userQuery.trim()) {
    return []
  }
  return retrieveLexical(opts)
}
