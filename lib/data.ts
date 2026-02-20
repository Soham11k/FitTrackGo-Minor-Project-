import siteData from "@/data/site.json"
import exercisesData from "@/data/exercises.json"
import achievementsData from "@/data/achievements.json"
import faqData from "@/data/faq.json"

export type Category = "all" | "strength" | "cardio" | "yoga" | "hiit"

export interface SiteConfig {
  companyName: string
  appName: string
  tagline: string
  supportEmail: string
  contactFormEndpoint: string
  privacyUrl: string
  termsUrl: string
  websiteUrl: string
  social: { twitter?: string; instagram?: string; facebook?: string }
}

export interface ExerciseItem {
  id: number
  title: string
  category: Category
  durationMin: number
  duration: string
  calories: number
  difficulty: string
  exercises: number
  rating: number
}

export interface AchievementDef {
  id: string
  title: string
  description: string
  type: "distance" | "activities" | "coachScore" | "streak" | "totalReps"
  targetValue: number
  unit?: string
}

export interface FaqItem {
  id: string
  question: string
  answer: string
}

export const siteConfig: SiteConfig = siteData as SiteConfig
export const exercisesDataset: ExerciseItem[] = exercisesData as ExerciseItem[]
export const achievementsDataset: AchievementDef[] = achievementsData as AchievementDef[]
export const faqDataset: FaqItem[] = faqData as FaqItem[]

export function getExercises(): ExerciseItem[] {
  return exercisesDataset
}

export function getAchievements(): AchievementDef[] {
  return achievementsDataset
}

export function getFaq(): FaqItem[] {
  return faqDataset
}
