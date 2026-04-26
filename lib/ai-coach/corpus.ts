import { EXERCISE_TIPS, type ExerciseId } from "@/lib/form-analysis"

export type CoachChunk = {
  id: string
  text: string
  exerciseId: ExerciseId | "general"
}

const STATIC: { id: string; text: string; exerciseId: CoachChunk["exerciseId"] }[] = [
  {
    id: "privacy-pose",
    exerciseId: "general",
    text:
      "FitTrack Go runs pose detection and form scoring entirely in the browser (MediaPipe). " +
      "Video frames are not sent to the cloud; only you choose what to save as session metadata (reps, scores).",
  },
  {
    id: "safety",
    exerciseId: "general",
    text:
      "This app does not provide medical advice. If you have pain, injury, or a health condition, consult a professional before high-intensity exercise.",
  },
  {
    id: "what-score-means",
    exerciseId: "general",
    text:
      "The form score reflects how closely your movement matched the exercise’s ideal angles and depth during the session, based on the camera view—not clinical measurement.",
  },
]

/** Flattened knowledge for RAG: in-app tips + short policy lines. */
export function buildCoachCorpus(): CoachChunk[] {
  const out: CoachChunk[] = [...STATIC] as CoachChunk[]

  for (const eid of Object.keys(EXERCISE_TIPS) as ExerciseId[]) {
    const tips = EXERCISE_TIPS[eid]
    tips.forEach((text, i) => {
      out.push({
        id: `${eid}-${i}`,
        text,
        exerciseId: eid,
      })
    })
  }
  return out
}
