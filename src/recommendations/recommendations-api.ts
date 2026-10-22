import type { SupabaseClient } from '@supabase/supabase-js'
import { loadStudentPreferences } from '../onboarding/profile-preferences'
import { loadResources } from '../resources/catalog'
import {
  experienceLevel,
  isRecord,
  rankResources,
  topicKnowledgeGaps,
} from './ranking'
import type { Recommendation } from './ranking'

export class RecommendationError extends Error {}
export interface RecommendationData {
  studentId: string
  recommendations: Recommendation[]
  profileMissing: boolean
  experienceMissing: boolean
  assessmentStatus: 'missing' | 'partial' | 'complete'
}

// No student ID argument: private selectors derive solely from Auth.getUser().
// RLS remains the authorization boundary; this module performs no writes.
export async function loadRecommendations(
  client: SupabaseClient,
  signal: AbortSignal,
): Promise<RecommendationData> {
  try {
    signal.throwIfAborted()
    const { data: identity, error: identityError } = await client.auth.getUser()
    signal.throwIfAborted()
    if (identityError || !identity.user?.id)
      throw new RecommendationError(
        'Your session could not be verified. Please sign in again to view recommendations.',
      )
    const studentId = identity.user.id
    const [profile, latest, resources] = await Promise.all([
      loadStudentPreferences(client, studentId, signal),
      client
        .from('assessment_attempts')
        .select('id, student_id, topic_scores, completed_at')
        .eq('student_id', studentId)
        .not('completed_at', 'is', null)
        .order('completed_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(1)
        .abortSignal(signal)
        .maybeSingle(),
      loadResources(client, signal),
    ])
    signal.throwIfAborted()
    if (latest.error) throw latest.error
    const attempt: unknown = latest.data
    if (
      attempt !== null &&
      (!isRecord(attempt) || attempt.student_id !== studentId)
    )
      throw new Error('Assessment owner mismatch')
    const completed =
      isRecord(attempt) &&
      typeof attempt.completed_at === 'string' &&
      Number.isFinite(Date.parse(attempt.completed_at))
    const topicScores: unknown = completed ? attempt.topic_scores : null
    const usableTopics = Object.values(topicKnowledgeGaps(topicScores)).filter(
      (gap) => gap !== null,
    ).length
    return {
      studentId,
      recommendations: rankResources(resources, profile, topicScores),
      profileMissing: profile === null,
      experienceMissing: !experienceLevel(profile?.experience_level),
      assessmentStatus: !completed
        ? 'missing'
        : usableTopics === 4
          ? 'complete'
          : 'partial',
    }
  } catch (error) {
    if (error instanceof RecommendationError) throw error
    // Keep database messages, private records, and authentication details out
    // of both the display and logs. A denied query is not "missing data".
    throw new RecommendationError(
      'Recommendations could not be loaded. Check your connection and try again.',
    )
  }
}
