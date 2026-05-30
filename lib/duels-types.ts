/**
 * Shared shape for async form duels (local + Supabase).
 */
export interface Duel {
  id: string
  code: string
  exercise: string
  createdAt: string
  challengerScore: number | null
  challengerName: string
  opponentScore: number | null
  opponentName: string | null
  settled: boolean
  /** Set for Supabase duels — used to show the correct score action per participant. */
  challengerUserId?: string
  opponentUserId?: string | null
  /** Arena trust tier flags — populated from coach session verification. */
  challengerVerified?: boolean
  opponentVerified?: boolean
  challengerFaceVerified?: boolean
  opponentFaceVerified?: boolean
  challengerSessionId?: string | null
  opponentSessionId?: string | null
}
