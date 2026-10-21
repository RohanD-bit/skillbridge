import { createClient } from '@supabase/supabase-js'
import { RequestFailure } from './assessment.ts'
import type { AssessmentDependencies } from './handlers.ts'
import { edgeRuntime } from './runtime.ts'

export function createDependencies(): AssessmentDependencies {
  const url = edgeRuntime.env.get('SUPABASE_URL')
  const keys = JSON.parse(
    edgeRuntime.env.get('SUPABASE_SECRET_KEYS') ?? '{}',
  ) as Record<string, string>
  const key = keys.default || edgeRuntime.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key)
    throw new RequestFailure(
      503,
      'assessment_unavailable',
      'The assessment service is not configured. Contact the project administrator.',
    )
  // Privileged client is confined to these server files. Never forward the
  // caller's Authorization header to its database requests.
  const admin = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      fetch: (input, init) =>
        fetch(input, { ...init, signal: AbortSignal.timeout(15000) }),
    },
  })
  return {
    authenticate: async (token) => {
      // Verify with Supabase Auth, not by decoding unverified JWT claims.
      const { data, error } = await admin.auth.getUser(token)
      if (error && (error.status === undefined || error.status >= 500))
        throw new RequestFailure(
          503,
          'assessment_unavailable',
          'The sign-in service could not be reached. Please try again.',
        )
      if (error || !data.user || data.user.role !== 'authenticated') return null
      return data.user.id
    },
    getPublicQuestions: async () => {
      const { data, error } = await admin
        .from('assessment_questions')
        .select('id, topic, question_text, options, difficulty')
        .eq('is_active', true)
        .order('created_at')
        .order('id')
      if (error) throw error
      return data
    },
    getScoringQuestions: async () => {
      const { data, error } = await admin
        .from('assessment_questions')
        .select('id, topic, correct_answer')
        .eq('is_active', true)
      if (error) throw error
      return data
    },
    saveAttempt: async (studentId, score) => {
      const { data, error } = await admin
        .from('assessment_attempts')
        .insert({
          student_id: studentId,
          total_questions: score.total_questions,
          correct_answers: score.correct_answers,
          topic_scores: score.topic_scores,
        })
        .select('id, completed_at')
        .single<{ id: string; completed_at: string }>()
      if (error) throw error
      return data
    },
  }
}
