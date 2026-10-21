import type { SupabaseClient } from '@supabase/supabase-js'
import type { StudentProfile } from '../auth/student-profile'
import { normalizePreferences, validatePreferences } from './preferences'
import type { LearningPreferences } from './preferences'

const columns =
  'id, interests, learning_goal, experience_level, created_at, updated_at'

function ownProfile(profile: StudentProfile | null, userId: string) {
  if (profile && profile.id !== userId)
    throw new Error('Profile owner mismatch')
  return profile
}

export async function loadStudentPreferences(
  client: SupabaseClient,
  userId: string,
  signal: AbortSignal,
): Promise<StudentProfile | null> {
  if (!userId) throw new Error('Authentication required')
  const { data, error } = await client
    .from('student_profiles')
    .select(columns)
    .eq('id', userId)
    .abortSignal(signal)
    .maybeSingle<StudentProfile>()
  if (error) throw error
  return ownProfile(data, userId)
}

export async function saveStudentPreferences(
  client: SupabaseClient,
  userId: string,
  values: LearningPreferences,
  signal: AbortSignal,
): Promise<StudentProfile> {
  if (!userId) throw new Error('Authentication required')
  if (Object.keys(validatePreferences(values)).length)
    throw new Error('Invalid learning preferences')
  const preferences = normalizePreferences(values)
  // Do not send id, timestamps, or unrelated fields in an update. RLS still applies.
  const update = () =>
    client
      .from('student_profiles')
      .update(preferences)
      .eq('id', userId)
      .select(columns)
      .abortSignal(signal)
      .maybeSingle<StudentProfile>()
  const existing = await update()
  if (existing.error) throw existing.error
  if (existing.data) return ownProfile(existing.data, userId)!

  const inserted = await client
    .from('student_profiles')
    .insert({ id: userId, ...preferences })
    .select(columns)
    .abortSignal(signal)
    .single<StudentProfile>()
  if (!inserted.error && inserted.data)
    return ownProfile(inserted.data, userId)!
  // A trigger or another tab may have inserted the profile after the update.
  if (inserted.error?.code === '23505') {
    const concurrent = await update()
    if (concurrent.error) throw concurrent.error
    if (concurrent.data) return ownProfile(concurrent.data, userId)!
  }
  throw inserted.error ?? new Error('Profile save returned no row')
}
