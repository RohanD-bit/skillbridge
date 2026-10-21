import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  getAssessmentQuestions,
  getLatestAssessment,
  parseQuestions,
  parseResult,
  submitAssessment,
} from './assessment-api'
import { fixtureQuestions, fixtureResult } from './test-fixtures'

function fixture() {
  const invoke = vi.fn()
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    abortSignal: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn(),
  }
  const from = vi.fn().mockReturnValue(chain)
  return {
    invoke,
    chain,
    from,
    client: { functions: { invoke }, from } as unknown as SupabaseClient,
    signal: new AbortController().signal,
  }
}
describe('frontend assessment API', () => {
  it('loads questions through the authenticated function rather than a table select', async () => {
    const { invoke, from, client, signal } = fixture()
    invoke.mockResolvedValue({
      data: { questions: fixtureQuestions },
      error: null,
    })
    expect(await getAssessmentQuestions(client, signal)).toEqual(
      fixtureQuestions,
    )
    expect(invoke).toHaveBeenCalledWith('assessment-questions', {
      body: {},
      signal,
    })
    expect(from).not.toHaveBeenCalled()
  })
  it('sends only IDs and selected options, with no student ID or score', async () => {
    const { invoke, from, client, signal } = fixture()
    invoke.mockResolvedValue({ data: fixtureResult, error: null })
    const answers = fixtureQuestions.map((question) => ({
      question_id: question.id,
      answer: 'A' as const,
      ignored: 'untrusted',
    }))
    expect(await submitAssessment(client, answers, signal)).toEqual(
      fixtureResult,
    )
    expect(invoke).toHaveBeenCalledWith('submit-assessment', {
      body: {
        answers: answers.map(({ question_id, answer }) => ({
          question_id,
          answer,
        })),
      },
      signal,
    })
    expect(from).not.toHaveBeenCalled()
  })
  it('reads the latest attempt with an explicit own-student filter and ordering', async () => {
    const { chain, from, client, signal } = fixture()
    chain.maybeSingle.mockResolvedValue({
      data: { ...fixtureResult, id: fixtureResult.attempt_id },
      error: null,
    })
    expect(
      await getLatestAssessment(client, 'fixture-student', signal),
    ).toEqual(fixtureResult)
    expect(from).toHaveBeenCalledExactlyOnceWith('assessment_attempts')
    expect(chain.eq).toHaveBeenCalledExactlyOnceWith(
      'student_id',
      'fixture-student',
    )
    expect(chain.order).toHaveBeenCalledWith('completed_at', {
      ascending: false,
    })
    expect(chain.limit).toHaveBeenCalledWith(1)
  })
  it('returns null for no previous attempt and rejects missing identity', async () => {
    const { chain, client, signal } = fixture()
    chain.maybeSingle.mockResolvedValue({ data: null, error: null })
    expect(
      await getLatestAssessment(client, 'fixture-student', signal),
    ).toBeNull()
    await expect(getLatestAssessment(client, '', signal)).rejects.toThrow(
      'log in',
    )
  })
  it('provides safe errors for expired sessions and transport failures', async () => {
    const { invoke, client, signal } = fixture()
    invoke.mockResolvedValueOnce({
      data: null,
      error: { context: new Response('sensitive raw error', { status: 401 }) },
    })
    await expect(getAssessmentQuestions(client, signal)).rejects.toThrow(
      'log out and log in',
    )
    invoke.mockRejectedValueOnce(new TypeError('private network internals'))
    await expect(getAssessmentQuestions(client, signal)).rejects.toThrow(
      'Check your connection',
    )
    invoke.mockResolvedValueOnce({
      data: null,
      error: { context: new Response('raw details', { status: 400 }) },
    })
    await expect(submitAssessment(client, [], signal)).rejects.toThrow(
      'submission was not accepted',
    )
  })
  it('does not render raw database failures', async () => {
    const { chain, client, signal } = fixture()
    chain.maybeSingle.mockResolvedValue({
      data: null,
      error: { message: 'PRIVATE_DATABASE_DETAILS' },
    })
    await expect(
      getLatestAssessment(client, 'fixture-student', signal),
    ).rejects.toThrow('saved results could not be loaded')
  })
  it('rejects incomplete, duplicate, or malformed question responses', () => {
    expect(() =>
      parseQuestions({ questions: fixtureQuestions.slice(1) }),
    ).toThrow()
    expect(() =>
      parseQuestions({
        questions: [...fixtureQuestions.slice(0, 9), fixtureQuestions[0]],
      }),
    ).toThrow()
    expect(() =>
      parseQuestions({
        questions: fixtureQuestions.map((value, index) =>
          index ? value : { ...value, options: {} },
        ),
      }),
    ).toThrow()
    expect(() =>
      parseQuestions({
        questions: fixtureQuestions.map((value, index) =>
          index ? value : { ...value, topic: '__proto__' },
        ),
      }),
    ).toThrow()
  })
  it('rejects inconsistent or impossible saved score totals', () => {
    expect(() =>
      parseResult({ ...fixtureResult, correct_answers: 11 }),
    ).toThrow()
    expect(() =>
      parseResult({ ...fixtureResult, total_questions: 9 }),
    ).toThrow()
    expect(() =>
      parseResult({ ...fixtureResult, correct_answers: 0 }),
    ).toThrow()
    expect(() =>
      parseResult({ ...fixtureResult, completed_at: 'invalid date' }),
    ).toThrow()
  })
})
