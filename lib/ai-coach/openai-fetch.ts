/** Minimal OpenAI REST helpers (no SDK) — embeddings + chat. */

const OPENAI_BASE = "https://api.openai.com/v1"

function authHeaders(): Record<string, string> {
  const key = process.env.OPENAI_API_KEY?.trim()
  if (!key) throw new Error("OPENAI_API_KEY is not set")
  return {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  }
}

export async function openaiCreateEmbeddings(
  model: "text-embedding-3-small",
  inputs: string[]
): Promise<number[][]> {
  const res = await fetch(`${OPENAI_BASE}/embeddings`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ model, input: inputs }),
  })
  if (!res.ok) {
    const t = await res.text()
    throw new Error(`OpenAI embeddings ${res.status}: ${t.slice(0, 400)}`)
  }
  const data = (await res.json()) as { data: { index: number; embedding: number[] }[] }
  const rows = data.data
    .slice()
    .sort((a, b) => a.index - b.index)
    .map((d) => d.embedding)
  return rows
}

export async function openaiChatJson(opts: {
  model: "gpt-4o-mini" | "gpt-4.1-mini"
  messages: { role: "system" | "user" | "assistant"; content: string }[]
  maxTokens: number
}): Promise<string> {
  const res = await fetch(`${OPENAI_BASE}/chat/completions`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      model: opts.model,
      messages: opts.messages,
      max_tokens: opts.maxTokens,
      temperature: 0.5,
    }),
  })
  if (!res.ok) {
    const t = await res.text()
    throw new Error(`OpenAI chat ${res.status}: ${t.slice(0, 500)}`)
  }
  const data = (await res.json()) as { choices: { message?: { content?: string } }[] }
  const text = data.choices[0]?.message?.content
  if (!text) throw new Error("Empty model response")
  return text
}

export function isOpenAIConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim())
}
