/**
 * Extra locale-aware coaching tips (space, environment) — layered on base EXERCISE_TIPS.
 */

import { findVariantBySpecId } from "./coach-exercise-catalog"
import { isLegacyExerciseId, type ExerciseId } from "./form-analysis"

const EXTRA: Partial<Record<ExerciseId, Partial<Record<string, string[]>>>> = {
  squat: {
    hi: ["कम जगह में घुटनों को चौड़ाई से खोलने से बचें — छोटे कमरे में कैमरा को कोने में रखें।", "यदि छत कम हो तो हाथ सामने फैलाने से बचें।"],
    de: ["Bei wenig Platz: Kamera in die Ecke, knappe Armführung.", "Bei niedriger Decke keine Arme über Kopf."],
    es: ["Poco espacio: cámara en esquina; no abras los brazos de más.", "Techo bajo: evita levantar brazos arriba."],
    fr: ["Peu de place : caméra dans un coin, amplitude des bras réduite.", "Plafond bas : pas de bras au-dessus de la tête."],
  },
  pushup: {
    hi: ["संकीर्ण कमरे में साइड एंगल मुश्किल हो तो 45° कोण आज़माएँ।"],
    de: ["Enger Raum: 45°-Winkel statt perfekter Seitenansicht ist ok."],
  },
  crunch: {
    de: ["Yogamatte auf hartem Boden verhindert Einsinken — bessere Hüftwinkel."],
    es: ["Colchoneta firme: mejor ángulo de cadera que sofa blando."],
  },
}

export function getCulturalTipExtras(locale: string, exercise: ExerciseId | string): string[] {
  const lang = (locale || "en").toLowerCase().split("-")[0] || "en"
  const fromCat = findVariantBySpecId(exercise)
  const key: ExerciseId | undefined =
    fromCat?.family.tipsKey ?? (isLegacyExerciseId(exercise) ? exercise : undefined)
  if (!key) return []
  const block = EXTRA[key]
  if (!block) return []
  return block[lang] ?? []
}
