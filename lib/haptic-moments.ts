import { pulse, type HapticPulse } from "@/lib/haptics"

export type HapticMoment = "tabChange" | "kmSplit" | "runStartCountdown" | "runPb" | "repVerified" | "formFault" | "duelWin" | "duelLoss" | "achievementUnlock" | "favoriteAdd" | "workoutComplete" | "themeChange"

const MOMENT_PULSE: Record<HapticMoment, HapticPulse> = {
  tabChange: "tick",
  kmSplit: "split",
  runStartCountdown: "tick",
  runPb: "celebrate",
  repVerified: "success",
  formFault: "fault",
  duelWin: "celebrate",
  duelLoss: "fault",
  achievementUnlock: "celebrate",
  favoriteAdd: "celebrate",
  workoutComplete: "success",
  themeChange: "celebrate",
}

export function hapticMoment(moment: HapticMoment): void {
  pulse(MOMENT_PULSE[moment])
}
