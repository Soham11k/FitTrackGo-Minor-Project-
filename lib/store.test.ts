import { describe, it, expect, beforeEach } from "vitest"
import {
  getProfile,
  getStreak,
  refreshStreak,
  getTotalStats,
  addWorkout,
  addRun,
  addCoachSession,
  getWorkouts,
  getRuns,
  getCoachSessions,
} from "./store"

const KEY = "fittrackgo_data"

describe("store", () => {
  beforeEach(() => {
    localStorage.removeItem(KEY)
  })

  describe("getProfile", () => {
    it("returns default profile when no data", () => {
      const profile = getProfile()
      expect(profile.name).toBe("")
      expect(profile.level).toBe("beginner")
      expect(profile.goals).toEqual([])
      expect(profile.onboarded).toBe(false)
    })
  })

  describe("getStreak", () => {
    it("returns 0 when no data", () => {
      expect(getStreak()).toBe(0)
    })

    it("returns stored streak after refreshStreak", () => {
      const s = refreshStreak()
      expect(s).toBe(1)
      expect(getStreak()).toBe(1)
    })
  })

  describe("refreshStreak", () => {
    it("sets streak to 1 when first activity today", () => {
      const s = refreshStreak()
      expect(s).toBe(1)
    })

    it("returns same streak when called again same day", () => {
      refreshStreak()
      const s2 = refreshStreak()
      expect(s2).toBe(1)
    })

    it("increments streak when last active was yesterday", () => {
      refreshStreak() // day 1 -> streak 1
      // Simulate yesterday as last active: write raw data
      const yesterday = new Date(Date.now() - 86_400_000).toISOString().split("T")[0]
      const data = JSON.parse(localStorage.getItem(KEY) ?? "{}")
      data.lastActiveDate = yesterday
      data.streak = 1
      localStorage.setItem(KEY, JSON.stringify(data))
      const s = refreshStreak()
      expect(s).toBe(2)
    })

    it("resets streak to 1 when last active was not yesterday", () => {
      const twoDaysAgo = new Date(Date.now() - 2 * 86_400_000).toISOString().split("T")[0]
      const data = JSON.parse(localStorage.getItem(KEY) ?? "{}")
      data.lastActiveDate = twoDaysAgo
      data.streak = 5
      localStorage.setItem(KEY, JSON.stringify(data))
      const s = refreshStreak()
      expect(s).toBe(1)
    })
  })

  describe("getTotalStats", () => {
    it("returns zeros when no data", () => {
      const stats = getTotalStats()
      expect(stats.totalWorkouts).toBe(0)
      expect(stats.totalRuns).toBe(0)
      expect(stats.totalCalories).toBe(0)
      expect(stats.totalDistance).toBe(0)
      expect(stats.totalActiveMinutes).toBe(0)
      expect(stats.streak).toBe(0)
    })

    it("aggregates workouts, runs, and coach sessions", () => {
      addWorkout({
        title: "Full Body",
        category: "strength",
        duration: 600,
        calories: 80,
        exerciseCount: 5,
      })
      addRun({
        distance: 2.5,
        duration: 900,
        pace: "6:00",
        calories: 120,
        path: [],
      })
      addCoachSession({
        exercise: "squat",
        reps: 10,
        score: 90,
        repScores: [90, 88, 92],
      })
      const stats = getTotalStats()
      expect(stats.totalWorkouts).toBe(2) // 1 workout + 1 coach session
      expect(stats.totalRuns).toBe(1)
      expect(stats.totalCalories).toBe(200)
      expect(stats.totalDistance).toBe(2.5)
      expect(stats.streak).toBe(1)
    })
  })

  describe("addWorkout / addRun / addCoachSession", () => {
    it("addWorkout adds a record with id and completedAt", () => {
      const before = getWorkouts().length
      addWorkout({
        title: "Unique Test Workout",
        category: "hiit",
        duration: 300,
        calories: 50,
        exerciseCount: 3,
      })
      const list = getWorkouts()
      const added = list.find((w) => w.title === "Unique Test Workout")
      expect(added).toBeDefined()
      expect(added!.id).toBeDefined()
      expect(added!.completedAt).toBeDefined()
      expect(list.length).toBe(before + 1)
    })

    it("addRun adds a record", () => {
      addRun({
        distance: 1,
        duration: 360,
        pace: "6:00",
        calories: 60,
        path: [[0, 0], [0.01, 0.01]],
      })
      const list = getRuns()
      expect(list).toHaveLength(1)
      expect(list[0].distance).toBe(1)
    })

    it("addCoachSession adds a record and refreshStreak runs", () => {
      addCoachSession({
        exercise: "pushup",
        reps: 5,
        score: 85,
        repScores: [80, 90],
      })
      const list = getCoachSessions()
      expect(list).toHaveLength(1)
      expect(getStreak()).toBe(1)
    })
  })
})
