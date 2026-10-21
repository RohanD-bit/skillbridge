import type { SupabaseClient } from '@supabase/supabase-js'

export interface StudentProfile {
  id: string
  interests: string[] | null
  learning_goal: string | null
  experience_level: string | null
  created_at: string
  updated_at: string
}

const columns =
  'id, interests, learning_goal, experience_level, created_at, updated_at'

export async function ensureStudentProfile(
  client: SupabaseClient,
  userId: string,
  signal: AbortSignal,
): Promise<StudentProfile> {
  const read = () =>
    client
      .from('student_profiles')
      .select(columns)
      .eq('id', userId)
      .abortSignal(signal)
      .maybeSingle<StudentProfile>()
  const existing = await read()
  if (existing.error) throw existing.error
  if (existing.data) return existing.data
  // Leave text/timestamp defaults to the existing schema; never update a profile.
  const inserted = await client
    .from('student_profiles')
    .insert({ id: userId, interests: [] })
    .select(columns)
    .abortSignal(signal)
    .single<StudentProfile>()
  if (!inserted.error && inserted.data) return inserted.data
  // Another tab or a database trigger may have created the row first.
  if (inserted.error?.code === '23505') {
    const concurrent = await read()
    if (concurrent.error) throw concurrent.error
    if (concurrent.data) return concurrent.data
  }
  throw inserted.error ?? new Error('Profile unavailable')
}
