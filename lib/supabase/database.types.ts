/**
 * Hand-rolled Database types that mirror supabase/schema.sql.
 *
 * Keep this in sync with migrations under supabase/migrations/. When you add a
 * table or column, add it here. The long-term goal is to replace this file
 * with the output of `supabase gen types typescript --schema public`; until we
 * have a hosted Supabase tied to CI, this is the single source of truth for
 * typed access from `lib/supabase/typed-store.ts`.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type UserLevel = "beginner" | "intermediate" | "advanced"
export type WearableProvider = "fitbit" | "google_fit" | "apple_health" | "garmin"

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          name: string | null
          level: UserLevel
          goals: string[]
          join_date: string
          onboarded: boolean
          streak: number
          last_active_date: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          name?: string | null
          level?: UserLevel
          goals?: string[]
          join_date?: string
          onboarded?: boolean
          streak?: number
          last_active_date?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>
      }
      workouts: {
        Row: {
          id: string
          user_id: string
          title: string
          category: string
          duration: number
          calories: number
          exercise_count: number
          completed_at: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          category: string
          duration: number
          calories: number
          exercise_count: number
          completed_at?: string
          created_at?: string
        }
        Update: Partial<Database["public"]["Tables"]["workouts"]["Insert"]>
      }
      runs: {
        Row: {
          id: string
          user_id: string
          distance: number
          duration: number
          pace: string
          calories: number
          path: Json | null
          completed_at: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          distance: number
          duration: number
          pace: string
          calories: number
          path?: Json | null
          completed_at?: string
          created_at?: string
        }
        Update: Partial<Database["public"]["Tables"]["runs"]["Insert"]>
      }
      coach_sessions: {
        Row: {
          id: string
          user_id: string
          exercise: string
          reps: number
          score: number
          rep_scores: number[]
          effective_reps: number | null
          verified_movement: boolean
          face_verified_session: boolean
          exercise_spec_id: string | null
          completed_at: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          exercise: string
          reps: number
          score: number
          rep_scores?: number[]
          effective_reps?: number | null
          verified_movement?: boolean
          face_verified_session?: boolean
          exercise_spec_id?: string | null
          completed_at?: string
          created_at?: string
        }
        Update: Partial<Database["public"]["Tables"]["coach_sessions"]["Insert"]>
      }
      user_custom_exercises: {
        Row: {
          id: string
          user_id: string
          spec_id: string
          display_name: string
          description: string
          form_spec: Json
          camera_note: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          spec_id: string
          display_name: string
          description?: string
          form_spec: Json
          camera_note?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database["public"]["Tables"]["user_custom_exercises"]["Insert"]>
      }
      favorites: {
        Row: {
          id: string
          user_id: string
          exercise_id: number
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          exercise_id: number
          created_at?: string
        }
        Update: Partial<Database["public"]["Tables"]["favorites"]["Insert"]>
      }
      wearable_connections: {
        Row: {
          id: string
          user_id: string
          provider: WearableProvider
          external_user_id: string | null
          access_token: string
          refresh_token: string
          token_expires_at: string
          scopes: string
          last_sync_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          provider: WearableProvider
          external_user_id?: string | null
          access_token: string
          refresh_token: string
          token_expires_at: string
          scopes?: string
          last_sync_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database["public"]["Tables"]["wearable_connections"]["Insert"]>
      }
      wearable_daily_metrics: {
        Row: {
          id: string
          user_id: string
          provider: WearableProvider
          metric_date: string
          resting_heart_rate: number | null
          spo2_avg_pct: number | null
          spo2_min_pct: number | null
          spo2_max_pct: number | null
          steps: number | null
          avg_hr: number | null
          sleep_min: number | null
          extra: Json
          source: string | null
          ingested_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          provider: WearableProvider
          metric_date: string
          resting_heart_rate?: number | null
          spo2_avg_pct?: number | null
          spo2_min_pct?: number | null
          spo2_max_pct?: number | null
          steps?: number | null
          avg_hr?: number | null
          sleep_min?: number | null
          extra?: Json
          source?: string | null
          ingested_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database["public"]["Tables"]["wearable_daily_metrics"]["Insert"]>
      }
      push_subscriptions: {
        Row: {
          id: string
          user_id: string
          endpoint: string
          p256dh: string
          auth: string
          user_agent: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          endpoint: string
          p256dh: string
          auth: string
          user_agent?: string | null
          created_at?: string
        }
        Update: Partial<Database["public"]["Tables"]["push_subscriptions"]["Insert"]>
      }
      notification_preferences: {
        Row: {
          user_id: string
          streak_reminder: boolean
          weekly_goal: boolean
          onboarding_nudge: boolean
          quiet_hours_start: number | null
          quiet_hours_end: number | null
          timezone: string | null
          updated_at: string
        }
        Insert: {
          user_id: string
          streak_reminder?: boolean
          weekly_goal?: boolean
          onboarding_nudge?: boolean
          quiet_hours_start?: number | null
          quiet_hours_end?: number | null
          timezone?: string | null
          updated_at?: string
        }
        Update: Partial<Database["public"]["Tables"]["notification_preferences"]["Insert"]>
      }
      programs: {
        Row: {
          id: string
          slug: string
          title: string
          description: string | null
          weeks: number
          level: UserLevel
          hero_image: string | null
          created_at: string
        }
        Insert: {
          id?: string
          slug: string
          title: string
          description?: string | null
          weeks: number
          level?: UserLevel
          hero_image?: string | null
          created_at?: string
        }
        Update: Partial<Database["public"]["Tables"]["programs"]["Insert"]>
      }
      program_days: {
        Row: {
          id: string
          program_id: string
          day_index: number
          title: string
          notes: string | null
        }
        Insert: {
          id?: string
          program_id: string
          day_index: number
          title: string
          notes?: string | null
        }
        Update: Partial<Database["public"]["Tables"]["program_days"]["Insert"]>
      }
      program_day_blocks: {
        Row: {
          id: string
          program_day_id: string
          order_index: number
          exercise_id: number
          sets: number
          reps: number | null
          duration_sec: number | null
          rest_sec: number
        }
        Insert: {
          id?: string
          program_day_id: string
          order_index: number
          exercise_id: number
          sets: number
          reps?: number | null
          duration_sec?: number | null
          rest_sec?: number
        }
        Update: Partial<Database["public"]["Tables"]["program_day_blocks"]["Insert"]>
      }
      user_program_enrollments: {
        Row: {
          id: string
          user_id: string
          program_id: string
          started_at: string
          current_day: number
          active: boolean
        }
        Insert: {
          id?: string
          user_id: string
          program_id: string
          started_at?: string
          current_day?: number
          active?: boolean
        }
        Update: Partial<Database["public"]["Tables"]["user_program_enrollments"]["Insert"]>
      }
      program_adherence: {
        Row: {
          id: string
          enrollment_id: string
          program_day_id: string
          completed_at: string
          score: number | null
          notes: string | null
        }
        Insert: {
          id?: string
          enrollment_id: string
          program_day_id: string
          completed_at?: string
          score?: number | null
          notes?: string | null
        }
        Update: Partial<Database["public"]["Tables"]["program_adherence"]["Insert"]>
      }
      user_clip_keys: {
        Row: {
          user_id: string
          wrapped_key: string
          salt: string
          algo: string
          iterations: number
          created_at: string
          updated_at: string
        }
        Insert: {
          user_id: string
          wrapped_key: string | Uint8Array
          salt: string | Uint8Array
          algo?: string
          iterations?: number
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database["public"]["Tables"]["user_clip_keys"]["Insert"]>
      }
      form_duels: {
        Row: {
          id: string
          code: string
          exercise: string
          challenger_user_id: string
          opponent_user_id: string | null
          challenger_name: string
          opponent_name: string | null
          challenger_score: number | null
          opponent_score: number | null
          settled: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          code: string
          exercise: string
          challenger_user_id: string
          opponent_user_id?: string | null
          challenger_name: string
          opponent_name?: string | null
          challenger_score?: number | null
          opponent_score?: number | null
          settled?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database["public"]["Tables"]["form_duels"]["Insert"]>
      }
    }
    Views: Record<string, never>
    Functions: {
      ensure_own_profile_bootstrap: {
        Args: {
          p_name: string
          p_level: string
          p_goals: string[]
          p_join_date: string
          p_onboarded: boolean
        }
        Returns: undefined
      }
      sync_own_profile_name: {
        Args: { p_name: string }
        Returns: undefined
      }
      join_form_duel: {
        Args: { p_code: string; p_opponent_name: string }
        Returns: Database["public"]["Tables"]["form_duels"]["Row"]
      }
      submit_form_duel_score: {
        Args: { p_duel_id: string; p_composite_score: number }
        Returns: Database["public"]["Tables"]["form_duels"]["Row"]
      }
    }
    Enums: {
      user_level: UserLevel
      wearable_provider: WearableProvider
    }
    CompositeTypes: Record<string, never>
  }
}

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"]
export type TablesInsert<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"]
export type TablesUpdate<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"]
