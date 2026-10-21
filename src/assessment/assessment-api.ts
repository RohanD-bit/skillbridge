import type { SupabaseClient } from '@supabase/supabase-js'
import { answerLetters, topicLabels } from './types'
import type {
  AssessmentQuestion,
  AssessmentResult,
  SubmittedAnswer,
  Topic,
} from './types'

export class AssessmentError extends Error {}
const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
const integer = (value: unknown): value is number =>
  Number.isInteger(value) && typeof value === 'number' && value >= 0
const invalidResponse = () =>
  new AssessmentError(
    'The assessment service returned an unexpected response. Please retry or contact the project administrator.',
  )

export function parseQuestions(value: unknown): AssessmentQuestion[] {
  if (
    !object(value) ||
    !Array.isArray(value.questions) ||
    value.questions.length !== 10
  )
    throw invalidResponse()
  const ids = new Set<string>()
  return value.questions.map((row) => {
    if (
      !object(row) ||
      typeof row.id !== 'string' ||
      !row.id ||
      ids.has(row.id) ||
      typeof row.topic !== 'string' ||
      !Object.hasOwn(topicLabels, row.topic) ||
      typeof row.question_text !== 'string' ||
      !row.question_text.trim() ||
      typeof row.difficulty !== 'string' ||
      !object(row.options)
    )
      throw invalidResponse()
    const options = row.options
    if (
      answerLetters.some(
        (letter) =>
          typeof options[letter] !== 'string' ||
          !(options[letter] as string).trim(),
      )
    )
      throw invalidResponse()
    ids.add(row.id)
    return {
      id: row.id,
      topic: row.topic as Topic,
      question_text: row.question_text,
      difficulty: row.difficulty,
      options: {
        A: options.A as string,
        B: options.B as string,
        C: options.C as string,
        D: options.D as string,
      },
    }
  })
}

export function parseResult(value: unknown): AssessmentResult {
  if (
    !object(value) ||
    typeof value.attempt_id !== 'string' ||
    !value.attempt_id ||
    value.total_questions !== 10 ||
    !integer(value.correct_answers) ||
    value.correct_answers > 10 ||
    typeof value.completed_at !== 'string' ||
    !Number.isFinite(Date.parse(value.completed_at)) ||
    !object(value.topic_scores)
  )
    throw invalidResponse()
  const topic_scores = {} as AssessmentResult['topic_scores']
  let total = 0
  let correct = 0
  for (const topic of Object.keys(topicLabels) as Topic[]) {
    const score = value.topic_scores[topic]
    if (
      !object(score) ||
      !integer(score.correct) ||
      !integer(score.total) ||
      score.correct > score.total
    )
      throw invalidResponse()
    topic_scores[topic] = { correct: score.correct, total: score.total }
    total += score.total
    correct += score.correct
  }
  if (total !== 10 || correct !== value.correct_answers) throw invalidResponse()
  return {
    attempt_id: value.attempt_id,
    total_questions: 10,
    correct_answers: value.correct_answers,
    topic_scores,
    completed_at: value.completed_at,
  }
}

async function functionError(error: unknown): Promise<AssessmentError> {
  const context = object(error) ? error.context : undefined
  if (context instanceof Response) {
    if (context.status === 401 || context.status === 403)
      return new AssessmentError(
        'Your session could not be verified. Please log out and log in again before retrying.',
      )
    if (
      context.status === 400 ||
      context.status === 415 ||
      context.status === 413
    )
      return new AssessmentError(
        'The submission was not accepted. Answer every current question once. If the assessment changed, reload the questions and try again.',
      )
  }
  return new AssessmentError(
    'The assessment service could not be reached or could not complete the request. Check your connection and confirm both Edge Functions are deployed, then retry.',
  )
}

export async function getAssessmentQuestions(
  client: SupabaseClient,
  signal: AbortSignal,
): Promise<AssessmentQuestion[]> {
  try {
    const { data, error } = await client.functions.invoke(
      'assessment-questions',
      { body: {}, signal },
    )
    if (error) throw await functionError(error)
    return parseQuestions(data)
  } catch (error) {
    if (error instanceof AssessmentError) throw error
    throw await functionError(error)
  }
}

export async function submitAssessment(
  client: SupabaseClient,
  answers: SubmittedAnswer[],
  signal: AbortSignal,
): Promise<AssessmentResult> {
  try {
    // Only question IDs and choices cross this boundary. All grading is server-side.
    const { data, error } = await client.functions.invoke('submit-assessment', {
      body: {
        answers: answers.map(({ question_id, answer }) => ({
          question_id,
          answer,
        })),
      },
      signal,
    })
    if (error) throw await functionError(error)
    return parseResult(data)
  } catch (error) {
    if (error instanceof AssessmentError) throw error
    throw await functionError(error)
  }
}

export async function getLatestAssessment(
  client: SupabaseClient,
  studentId: string,
  signal: AbortSignal,
): Promise<AssessmentResult | null> {
  if (!studentId)
    throw new AssessmentError('Please log in to view your results.')
  try {
    const { data, error } = await client
      .from('assessment_attempts')
      .select(
        'id, total_questions, correct_answers, topic_scores, completed_at',
      )
      .eq('student_id', studentId)
      .order('completed_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(1)
      .abortSignal(signal)
      .maybeSingle()
    if (error) throw new Error('Result lookup failed')
    return data ? parseResult({ ...data, attempt_id: data.id }) : null
  } catch (error) {
    if (error instanceof AssessmentError) throw error
    throw new AssessmentError(
      'Your saved results could not be loaded. Check your connection and try again.',
    )
  }
}
