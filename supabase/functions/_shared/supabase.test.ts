// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createDependencies } from './supabase.ts'

const mock = vi.hoisted(() => {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    single: vi.fn(),
  }
  return {
    chain,
    getUser: vi.fn(),
    from: vi.fn().mockReturnValue(chain),
    createClient: vi.fn(),
    env: vi.fn(),
  }
})
vi.mock('@supabase/supabase-js', () => ({ createClient: mock.createClient }))
vi.mock('./runtime.ts', () => ({ edgeRuntime: { env: { get: mock.env } } }))
beforeEach(() => {
  vi.clearAllMocks()
  mock.env.mockImplementation((name) =>
    name === 'SUPABASE_URL'
      ? 'https://fixture.example.test'
      : name === 'SUPABASE_SERVICE_ROLE_KEY'
        ? 'fixture-server-only-not-a-real-key'
        : undefined,
  )
  mock.createClient.mockReturnValue({
    auth: { getUser: mock.getUser },
    from: mock.from,
  })
  mock.getUser.mockResolvedValue({
    data: { user: { id: 'verified-student', role: 'authenticated' } },
    error: null,
  })
})
describe('Supabase server adapter', () => {
  it('verifies the supplied bearer token with Auth.getUser, without trusting claims', async () => {
    expect(await createDependencies().authenticate('fixture-token')).toBe(
      'verified-student',
    )
    expect(mock.getUser).toHaveBeenCalledExactlyOnceWith('fixture-token')
    expect(mock.from).not.toHaveBeenCalled()
  })
  it('rejects unverified identities and handles Auth network failure safely', async () => {
    mock.getUser.mockResolvedValueOnce({
      data: { user: null },
      error: { status: 401 },
    })
    expect(await createDependencies().authenticate('expired')).toBeNull()
    mock.getUser.mockResolvedValueOnce({
      data: { user: null },
      error: { status: 503 },
    })
    await expect(createDependencies().authenticate('fixture')).rejects.toThrow(
      'could not be reached',
    )
  })
  it('selects active public questions without requesting the key column', async () => {
    await createDependencies().getPublicQuestions()
    expect(mock.from).toHaveBeenCalledWith('assessment_questions')
    expect(mock.chain.select).toHaveBeenCalledWith(
      'id, topic, question_text, options, difficulty',
    )
    expect(mock.chain.eq).toHaveBeenCalledWith('is_active', true)
  })
  it('retrieves keys only in the server-side scoring path', async () => {
    await createDependencies().getScoringQuestions()
    expect(mock.chain.select).toHaveBeenCalledWith('id, topic, correct_answer')
    expect(mock.chain.eq).toHaveBeenCalledWith('is_active', true)
  })
  it('inserts verified results and returns only saved metadata', async () => {
    mock.chain.single.mockResolvedValue({
      data: { id: 'attempt', completed_at: '2026-10-20T00:00:00Z' },
      error: null,
    })
    const score = {
      total_questions: 10,
      correct_answers: 0,
      topic_scores: {
        budgeting: { correct: 0, total: 3 },
        saving: { correct: 0, total: 2 },
        credit: { correct: 0, total: 3 },
        investing: { correct: 0, total: 2 },
      },
    }
    await createDependencies().saveAttempt('verified-student', score)
    expect(mock.chain.insert).toHaveBeenCalledExactlyOnceWith({
      student_id: 'verified-student',
      ...score,
    })
    expect(mock.chain.select).toHaveBeenCalledWith('id, completed_at')
  })
  it('does not swallow database insert errors', async () => {
    mock.chain.single.mockResolvedValue({
      data: null,
      error: { code: '42501' },
    })
    await expect(
      createDependencies().saveAttempt('verified-student', {
        total_questions: 10,
        correct_answers: 0,
        topic_scores: {
          budgeting: { correct: 0, total: 3 },
          saving: { correct: 0, total: 2 },
          credit: { correct: 0, total: 3 },
          investing: { correct: 0, total: 2 },
        },
      }),
    ).rejects.toEqual({ code: '42501' })
  })
  it('fails safely without server credentials', () => {
    mock.env.mockReturnValue(undefined)
    expect(createDependencies).toThrow('not configured')
  })
})
