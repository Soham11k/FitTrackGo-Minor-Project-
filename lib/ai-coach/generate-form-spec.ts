/**
 * AI-assisted FormSpec generation for custom exercises.
 */

import { parseVisionModelJsonPayload } from "@/lib/ai-coach/clip-review"
import { isOpenAIConfigured, openaiChatJson } from "@/lib/ai-coach/openai-fetch"
import { loadSpec } from "@/lib/form-engine/registry"
import type { FormSpec, LoadType } from "@/lib/form-engine/types"
import { buildCustomSpecId, validateFormSpec } from "@/lib/form-engine/validate-spec"
import squatExample from "@/data/form-specs/squat.json"

export type GenerateFormSpecInput = {
  name: string
  description: string
  category?: string
  loadType?: LoadType
  similarToSpecId?: string
}

export type GenerateFormSpecPreview = {
  rulesSummary: string[]
  phasesSummary: string[]
  repPattern?: string
  cameraNote?: string
}

export type GenerateFormSpecResult = {
  spec: FormSpec
  specId: string
  preview: GenerateFormSpecPreview
}

const METRIC_IDS_LIST = [
  "knee_angle_avg",
  "knee_angle_left",
  "knee_angle_right",
  "knee_angle_min",
  "knee_angle_max",
  "elbow_angle_avg",
  "elbow_angle_left",
  "elbow_angle_right",
  "back_angle_avg",
  "hip_hinge_avg",
  "shoulder_angle_avg",
  "shoulder_y_avg",
  "hip_y_avg",
  "knee_y_avg",
  "wrist_y_avg",
  "ankle_y_avg",
  "nose_y",
  "depth_ratio",
  "hip_sag_y",
  "body_line_deviation",
  "knee_tracking_x",
  "shoulder_width_x",
  "elbow_flare_ratio",
  "knee_symmetry_diff",
  "elbow_symmetry_diff",
  "wrist_spread_x",
  "ankle_spread_x",
  "total_spread_x",
  "bar_drift_x",
  "shoulder_hip_y_delta",
  "load_ratio",
].join(", ")

const SYSTEM_PROMPT = `You author JSON FormSpec objects for a fitness app's pose-based form coach.
Return ONLY valid JSON (no markdown). Schema:

{
  "id": "placeholder",
  "displayName": string,
  "category": "upper"|"lower"|"core"|"cardio"|"compound",
  "loadType": "none"|"bodyweight"|"external",
  "requiredLandmarks": number[] (MediaPipe indices 0-32, at least 6),
  "visibleFraction": 0.5-0.9,
  "positiveLine": string,
  "repPattern": "top_bottom_top"|"bottom_top_bottom"|"hold",
  "phases": [{ "name": "idle"|"eccentric"|"bottom"|"concentric"|"top", "enterWhen": Condition }],
  "rules": [{ "id", "region": "legs"|"arms"|"torso"|"core"|"global", "penalty": 5-15, "when": Condition, "feedback": string, "breakdown": optional }],
  "hudAngles": optional
}

Condition: { "metric": MetricId, "op": ">"|">="|"<"|"<="|"between", "value": number, "hi"?: number }
Or nested: { "all": Condition[] }, { "any": Condition[] }, { "not": Condition }

Allowed MetricId values: ${METRIC_IDS_LIST}

Rules:
- 3-6 rules, total penalty sum ≤ 80
- Imperative feedback under 12 words
- 2-3 phases with enterWhen on primary angle metric
- repPattern matches movement (hold for planks/wall sits)
- Use realistic angle thresholds for the described movement

Example spec:
${JSON.stringify(squatExample, null, 0).slice(0, 2800)}`

function buildUserPrompt(input: GenerateFormSpecInput, validationErrors?: string[]): string {
  const lines = [
    `Exercise name: ${input.name.trim()}`,
    `Movement description: ${input.description.trim()}`,
  ]
  if (input.category) lines.push(`Category hint: ${input.category}`)
  if (input.loadType) lines.push(`Load type: ${input.loadType}`)
  if (input.similarToSpecId) {
    const similar = loadSpec(input.similarToSpecId)
    if (similar) {
      lines.push(`Similar built-in spec (${input.similarToSpecId}) — adapt thresholds, keep structure:`)
      lines.push(JSON.stringify(similar, null, 0).slice(0, 4000))
    }
  }
  if (validationErrors?.length) {
    lines.push(`Previous JSON failed validation. Fix these errors:\n${validationErrors.join("\n")}`)
  }
  lines.push('Respond with the FormSpec JSON only. Set "id" to "placeholder".')
  return lines.join("\n\n")
}

function summarizePreview(spec: FormSpec): GenerateFormSpecPreview {
  const rulesSummary = spec.rules.slice(0, 5).map((r) => r.feedback)
  const phasesSummary = spec.phases.map((p) => p.name)
  const cameraNote =
    spec.requiredLandmarks.length >= 8
      ? "Frame your full body side-on or at 45° so hips, knees, and shoulders stay visible."
      : "Keep the working limbs and torso in frame with good lighting."
  return {
    rulesSummary,
    phasesSummary,
    repPattern: spec.repPattern,
    cameraNote,
  }
}

export async function generateFormSpecFromDescription(
  input: GenerateFormSpecInput,
): Promise<GenerateFormSpecResult> {
  if (!isOpenAIConfigured()) {
    throw new Error("OpenAI not configured")
  }

  const specId = buildCustomSpecId(input.name)
  let lastErrors: string[] = []

  for (let attempt = 0; attempt < 2; attempt++) {
    const raw = await openaiChatJson({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildUserPrompt(input, attempt > 0 ? lastErrors : undefined) },
      ],
      maxTokens: 3500,
    })

    const parsed = parseVisionModelJsonPayload(raw)
    const validated = validateFormSpec(parsed, specId)
    if (validated.ok) {
      const spec = validated.spec
      return {
        spec,
        specId,
        preview: summarizePreview(spec),
      }
    }
    lastErrors = validated.errors
  }

  throw new Error(`validation_failed: ${lastErrors.join("; ")}`)
}
