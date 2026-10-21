// Server-only module. Never import this file into the React application.
export const expectedQuestions = 10
export const topics = ['budgeting', 'saving', 'credit', 'investing'] as const
export type Topic = (typeof topics)[number]
export type Answer = 'A' | 'B' | 'C' | 'D'
export type TopicScores = Record<Topic, { correct: number; total: number }>
export interface SubmittedAnswer {
  question_id: string
  answer: Answer
}
export interface ScoringQuestion {
  id: string
  topic: Topic
  correct_answer: Answer
}
export interface PublicQuestion {
  id: string
  topic: Topic
  question_text: string
  options: Record<Answer, string>
  difficulty: string
}
export interface Score {
  total_questions: number
  correct_answers: number
  topic_scores: TopicScores
}

export class RequestFailure extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message)
  }
}
export const unavailable = () =>
  new RequestFailure(
    503,
    'assessment_unavailable',
    'The assessment is temporarily unavailable. Please try again later.',
  )
const invalid = () =>
  new RequestFailure(
    400,
    'invalid_submission',
    'Answer all 10 current questions exactly once using A, B, C, or D. Reload the assessment if its questions have changed.',
  )
export const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
export const isAnswer = (value: unknown): value is Answer =>
  typeof value === 'string' && ['A', 'B', 'C', 'D'].includes(value)
export const isTopic = (value: unknown): value is Topic =>
  typeof value === 'string' && topics.some((topic) => topic === value)
const isId = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)

export function parseSubmission(body: unknown): SubmittedAnswer[] {
  if (
    !isObject(body) ||
    Object.keys(body).length !== 1 ||
    !Array.isArray(body.answers) ||
    body.answers.length !== expectedQuestions
  )
    throw invalid()
  const seen = new Set<string>()
  return body.answers.map((value) => {
    if (
      !isObject(value) ||
      Object.keys(value).length !== 2 ||
      !isId(value.question_id) ||
      !isAnswer(value.answer)
    )
      throw invalid()
    const id = value.question_id.toLowerCase()
    if (seen.has(id)) throw invalid()
    seen.add(id)
    return { question_id: id, answer: value.answer }
  })
}

function validInventory(
  rows: unknown,
): asserts rows is Record<string, unknown>[] {
  if (!Array.isArray(rows) || rows.length !== expectedQuestions)
    throw unavailable()
  const ids = new Set<string>()
  for (const row of rows) {
    if (
      !isObject(row) ||
      !isId(row.id) ||
      !isTopic(row.topic) ||
      ids.has(row.id.toLowerCase())
    )
      throw unavailable()
    ids.add(row.id.toLowerCase())
  }
}

export function publicQuestions(rows: unknown): PublicQuestion[] {
  validInventory(rows)
  return rows.map((row) => {
    if (
      typeof row.question_text !== 'string' ||
      !row.question_text.trim() ||
      typeof row.difficulty !== 'string' ||
      !isObject(row.options)
    )
      throw unavailable()
    const options = row.options
    if (
      ['A', 'B', 'C', 'D'].some(
        (key) =>
          typeof options[key] !== 'string' || !(options[key] as string).trim(),
      )
    )
      throw unavailable()
    // Explicit allowlists, including nested options, prevent accidental key leakage.
    return {
      id: (row.id as string).toLowerCase(),
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

export function scoreSubmission(
  rows: unknown,
  answers: SubmittedAnswer[],
): Score {
  validInventory(rows)
  const questions: ScoringQuestion[] = rows.map((row) => {
    if (!isAnswer(row.correct_answer)) throw unavailable()
    return {
      id: (row.id as string).toLowerCase(),
      topic: row.topic as Topic,
      correct_answer: row.correct_answer,
    }
  })
  const byId = new Map(questions.map((question) => [question.id, question]))
  if (
    answers.length !== expectedQuestions ||
    new Set(answers.map((value) => value.question_id)).size !==
      expectedQuestions ||
    answers.some(
      (value) => !byId.has(value.question_id) || !isAnswer(value.answer),
    )
  )
    throw invalid()
  const topic_scores: TopicScores = {
    budgeting: { correct: 0, total: 0 },
    saving: { correct: 0, total: 0 },
    credit: { correct: 0, total: 0 },
    investing: { correct: 0, total: 0 },
  }
  let correct_answers = 0
  for (const answer of answers) {
    const question = byId.get(answer.question_id)!
    const score = topic_scores[question.topic]
    score.total++
    if (question.correct_answer === answer.answer) {
      score.correct++
      correct_answers++
    }
  }
  return { total_questions: expectedQuestions, correct_answers, topic_scores }
}
