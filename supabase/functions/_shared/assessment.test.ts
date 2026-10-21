// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  parseSubmission,
  publicQuestions,
  scoreSubmission,
} from './assessment.ts'
import { createQuestionsHandler, createSubmissionHandler } from './handlers.ts'
import type { AssessmentDependencies } from './handlers.ts'

const subjects = [
  'budgeting',
  'budgeting',
  'budgeting',
  'saving',
  'saving',
  'credit',
  'credit',
  'credit',
  'investing',
  'investing',
]
const bank = subjects.map((topic, index) => ({
  id: '10000000-0000-4000-8000-' + String(index + 1).padStart(12, '0'),
  topic,
  correct_answer: 'A',
  question_text: 'Synthetic question ' + (index + 1),
  options: {
    A: 'First choice',
    B: 'Second choice',
    C: 'Third choice',
    D: 'Fourth choice',
  },
  difficulty: 'beginner',
}))
const answers = bank.map((question, index) => ({
  question_id: question.id,
  answer: [0, 1, 3, 5, 6, 8].includes(index) ? 'A' : 'B',
}))
const expected = {
  total_questions: 10,
  correct_answers: 6,
  topic_scores: {
    budgeting: { correct: 2, total: 3 },
    saving: { correct: 1, total: 2 },
    credit: { correct: 2, total: 3 },
    investing: { correct: 1, total: 2 },
  },
}
const deps: AssessmentDependencies = {
  authenticate: vi.fn(),
  getPublicQuestions: vi.fn(),
  getScoringQuestions: vi.fn(),
  saveAttempt: vi.fn(),
}
const questionHandler = createQuestionsHandler(() => deps)
const submitHandler = createSubmissionHandler(() => deps)
function request(body: unknown = { answers }, token = 'fixture-session') {
  return new Request('https://functions.example.test/submit-assessment', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
}
beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(deps.authenticate).mockResolvedValue('verified-student-id')
  vi.mocked(deps.getPublicQuestions).mockResolvedValue(bank)
  vi.mocked(deps.getScoringQuestions).mockResolvedValue(bank)
  vi.mocked(deps.saveAttempt).mockResolvedValue({
    id: 'saved-attempt',
    completed_at: '2026-10-20T12:00:00Z',
  })
})

describe('server-only grading and validation', () => {
  it('calculates the overall score and exact topic counts', () => {
    expect(scoreSubmission(bank, parseSubmission({ answers }))).toEqual(
      expected,
    )
  })
  it('accepts shuffled answers without relying on client ordering', () => {
    expect(
      scoreSubmission(
        bank,
        parseSubmission({ answers: [...answers].reverse() }),
      ),
    ).toEqual(expected)
  })
  it('handles zero correct and all correct', () => {
    expect(
      scoreSubmission(
        bank,
        parseSubmission({
          answers: answers.map((value) => ({ ...value, answer: 'B' })),
        }),
      ).correct_answers,
    ).toBe(0)
    expect(
      scoreSubmission(
        bank,
        parseSubmission({
          answers: answers.map((value) => ({ ...value, answer: 'A' })),
        }),
      ).correct_answers,
    ).toBe(10)
  })
  it.each([
    ['missing answer', { answers: answers.slice(1) }],
    ['extra answer', { answers: [...answers, answers[0]] }],
    ['duplicate ID', { answers: [...answers.slice(0, 9), answers[0]] }],
    [
      'invalid option',
      {
        answers: answers.map((value, index) =>
          index ? value : { ...value, answer: 'E' },
        ),
      },
    ],
    [
      'lowercase option',
      {
        answers: answers.map((value, index) =>
          index ? value : { ...value, answer: 'a' },
        ),
      },
    ],
    [
      'malformed ID',
      {
        answers: answers.map((value, index) =>
          index ? value : { ...value, question_id: 'not-a-uuid' },
        ),
      },
    ],
    ['client student ID', { answers, student_id: 'victim-id' }],
    ['client score', { answers, correct_answers: 10 }],
    [
      'extra answer metadata',
      {
        answers: answers.map((value, index) =>
          index ? value : { ...value, score: 1 },
        ),
      },
    ],
  ])(
    'rejects %s before reading keys or writing results',
    async (_label, body) => {
      expect((await submitHandler(request(body))).status).toBe(400)
      expect(deps.getScoringQuestions).not.toHaveBeenCalled()
      expect(deps.saveAttempt).not.toHaveBeenCalled()
    },
  )
  it('canonicalizes UUID case before duplicate validation', () => {
    const withLetters = bank.map((value, index) => ({
      ...value,
      id: index === 0 ? 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' : value.id,
    }))
    const submitted = withLetters.map((value) => ({
      question_id: value.id,
      answer: 'A',
    }))
    submitted[9] = {
      ...submitted[0],
      question_id: submitted[0].question_id.toUpperCase(),
    }
    expect(() => parseSubmission({ answers: submitted })).toThrow()
  })
  it('rejects unknown and inactive IDs rather than scoring a partial set', async () => {
    const unknown = answers.map((value, index) =>
      index
        ? value
        : { ...value, question_id: 'ffffffff-ffff-4fff-8fff-ffffffffffff' },
    )
    expect((await submitHandler(request({ answers: unknown }))).status).toBe(
      400,
    )
    expect(deps.saveAttempt).not.toHaveBeenCalled()
  })
  it('fails closed if the active inventory changes or its keys are invalid', async () => {
    vi.mocked(deps.getScoringQuestions).mockResolvedValue(bank.slice(1))
    expect((await submitHandler(request())).status).toBe(503)
    expect(deps.saveAttempt).not.toHaveBeenCalled()
    expect(() =>
      scoreSubmission(
        bank.map((value, index) =>
          index ? value : { ...value, correct_answer: 'E' },
        ),
        parseSubmission({ answers }),
      ),
    ).toThrow()
  })
})

describe('Edge Function HTTP boundaries', () => {
  it('requires authentication for both endpoints', async () => {
    for (const handle of [questionHandler, submitHandler]) {
      const noToken = new Request('https://functions.example.test', {
        method: 'POST',
      })
      expect((await handle(noToken)).status).toBe(401)
    }
    expect(deps.authenticate).not.toHaveBeenCalled()
    expect(deps.getPublicQuestions).not.toHaveBeenCalled()
    expect(deps.getScoringQuestions).not.toHaveBeenCalled()
  })
  it('rejects an invalid or expired token without reading questions', async () => {
    vi.mocked(deps.authenticate).mockResolvedValue(null)
    expect((await questionHandler(request())).status).toBe(401)
    expect((await submitHandler(request())).status).toBe(401)
    expect(deps.getPublicQuestions).not.toHaveBeenCalled()
    expect(deps.getScoringQuestions).not.toHaveBeenCalled()
    expect(deps.saveAttempt).not.toHaveBeenCalled()
  })
  it('allows browser preflight without database access and rejects unsupported methods', async () => {
    const response = await questionHandler(
      new Request('https://functions.example.test', { method: 'OPTIONS' }),
    )
    expect(response.status).toBe(204)
    expect(response.headers.get('Access-Control-Allow-Headers')).toContain(
      'authorization',
    )
    expect(deps.authenticate).not.toHaveBeenCalled()
    expect(
      (await questionHandler(new Request('https://functions.example.test')))
        .status,
    ).toBe(405)
  })
  it('returns only allowlisted public question fields, including nested options', async () => {
    vi.mocked(deps.getPublicQuestions).mockResolvedValue(
      bank.map((row) => ({
        ...row,
        sensitive_internal: 'private-value',
        options: { ...row.options, correct_answer: 'private-value' },
      })),
    )
    const response = await questionHandler(request({}))
    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    const text = await response.text()
    expect(text).not.toContain('correct_answer')
    expect(text).not.toContain('private-value')
    expect(Object.keys(JSON.parse(text).questions[0]).sort()).toEqual([
      'difficulty',
      'id',
      'options',
      'question_text',
      'topic',
    ])
    expect(() => publicQuestions(bank.slice(1))).toThrow()
  })
  it('derives identity from verified Auth and writes only computed results', async () => {
    const response = await submitHandler(request())
    expect(response.status).toBe(200)
    expect(deps.authenticate).toHaveBeenCalledWith('fixture-session')
    expect(deps.saveAttempt).toHaveBeenCalledExactlyOnceWith(
      'verified-student-id',
      expected,
    )
    expect(await response.json()).toEqual({
      ...expected,
      attempt_id: 'saved-attempt',
      completed_at: '2026-10-20T12:00:00Z',
    })
  })
  it.each(['question read', 'database write', 'authentication network'])(
    'sanitizes %s failures',
    async (operation) => {
      const failure = new Error('PRIVATE_DATABASE_CREDENTIAL_AND_KEY_DETAILS')
      if (operation === 'question read')
        vi.mocked(deps.getScoringQuestions).mockRejectedValue(failure)
      if (operation === 'database write')
        vi.mocked(deps.saveAttempt).mockRejectedValue(failure)
      if (operation === 'authentication network')
        vi.mocked(deps.authenticate).mockRejectedValue(failure)
      const response = await submitHandler(request())
      expect(response.status).toBe(500)
      expect(await response.text()).not.toContain('PRIVATE_DATABASE')
    },
  )
  it('never reports success if a database write fails', async () => {
    vi.mocked(deps.saveAttempt).mockRejectedValue(new Error('insert denied'))
    const response = await submitHandler(request())
    expect(response.status).toBe(500)
    expect(await response.json()).not.toHaveProperty('attempt_id')
  })
  it('rejects malformed JSON and oversized bodies', async () => {
    const malformed = new Request('https://functions.example.test', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer fixture',
        'Content-Type': 'application/json',
      },
      body: '{',
    })
    expect((await submitHandler(malformed)).status).toBe(400)
    const large = request({ answers, padding: 'a'.repeat(17000) })
    expect((await submitHandler(large)).status).toBe(413)
    expect(deps.saveAttempt).not.toHaveBeenCalled()
  })
})
