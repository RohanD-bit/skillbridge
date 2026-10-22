import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import { resourceFixtures } from '../resources/test-fixtures'
import { loadRecommendations } from './recommendations-api'

function database() {
  const studentId = 'verified-student'
  const results: Record<string, { data: unknown; error: unknown }> = {
    student_profiles: {
      data: {
        id: studentId,
        interests: ['budgeting'],
        learning_goal: 'Control spending',
        experience_level: 'beginner',
      },
      error: null,
    },
    assessment_attempts: {
      data: {
        id: 'latest-attempt',
        student_id: studentId,
        completed_at: '2026-10-21T12:00:00Z',
        topic_scores: {
          budgeting: { correct: 1, total: 3 },
          saving: { correct: 2, total: 2 },
          credit: { correct: 1, total: 3 },
          investing: { correct: 1, total: 2 },
        },
      },
      error: null,
    },
    learning_resources: {
      data: resourceFixtures.map((row) => ({ ...row, is_active: true })),
      error: null,
    },
  }
  const queries = new Map<string, ReturnType<typeof query>>()
  function query(table: string) {
    const chain = {
      select: vi.fn(() => chain),
      eq: vi.fn(() => chain),
      not: vi.fn(() => chain),
      order: vi.fn(() => chain),
      limit: vi.fn(() => chain),
      abortSignal: vi.fn(() => chain),
      maybeSingle: vi.fn(async () => results[table]),
      then: (resolve: (value: (typeof results)[string]) => unknown) =>
        Promise.resolve(results[table]).then(resolve),
    }
    return chain
  }
  const from = vi.fn((table: string) => {
    const chain = query(table)
    queries.set(table, chain)
    return chain
  })
  const getUser = vi
    .fn()
    .mockResolvedValue({ data: { user: { id: studentId } }, error: null })
  return {
    client: { auth: { getUser }, from } as unknown as SupabaseClient,
    results,
    queries,
    from,
    getUser,
    studentId,
  }
}
const signal = () => new AbortController().signal

describe('recommendation data integration', () => {
  it('verifies identity then makes exactly one read of each existing table', async () => {
    const db = database()
    const cancellation = signal()
    const result = await loadRecommendations(db.client, cancellation)
    expect(result.studentId).toBe('verified-student')
    expect(result.recommendations).toHaveLength(5)
    expect(result.recommendations[0].title).toBe('Budgeting basics')
    expect(result.assessmentStatus).toBe('complete')
    expect(db.getUser).toHaveBeenCalledExactlyOnceWith()
    expect(db.from.mock.calls).toEqual([
      ['student_profiles'],
      ['assessment_attempts'],
      ['learning_resources'],
    ])
    expect(db.getUser.mock.invocationCallOrder[0]).toBeLessThan(
      db.from.mock.invocationCallOrder[0],
    )
    expect(db.queries.get('student_profiles')?.eq).toHaveBeenCalledWith(
      'id',
      db.studentId,
    )
    const attempts = db.queries.get('assessment_attempts')!
    expect(attempts.select).toHaveBeenCalledWith(
      'id, student_id, topic_scores, completed_at',
    )
    expect(attempts.eq).toHaveBeenCalledExactlyOnceWith(
      'student_id',
      db.studentId,
    )
    expect(attempts.not).toHaveBeenCalledWith('completed_at', 'is', null)
    expect(attempts.order.mock.calls).toEqual([
      ['completed_at', { ascending: false }],
      ['id', { ascending: false }],
    ])
    expect(attempts.limit).toHaveBeenCalledWith(1)
    for (const query of db.queries.values())
      expect(query.abortSignal).toHaveBeenCalledWith(cancellation)
    expect(db.queries.get('learning_resources')?.eq).toHaveBeenCalledWith(
      'is_active',
      true,
    )
  })
  it('does not query private data for an unauthenticated client', async () => {
    const db = database()
    db.getUser.mockResolvedValue({ data: { user: null }, error: null })
    await expect(loadRecommendations(db.client, signal())).rejects.toThrow(
      'Please sign in again',
    )
    expect(db.from).not.toHaveBeenCalled()
  })
  it('does not query data when identity verification fails', async () => {
    const db = database()
    db.getUser.mockResolvedValue({
      data: { user: { id: 'untrusted' } },
      error: { message: 'private Auth detail' },
    })
    await expect(loadRecommendations(db.client, signal())).rejects.toThrow(
      'session could not be verified',
    )
    expect(db.from).not.toHaveBeenCalled()
  })
  it('sanitizes rejected authentication network requests', async () => {
    const db = database()
    db.getUser.mockRejectedValue(new Error('private token diagnostic'))
    await expect(loadRecommendations(db.client, signal())).rejects.toThrow(
      'Check your connection',
    )
    expect(db.from).not.toHaveBeenCalled()
  })
  it.each(['student_profiles', 'assessment_attempts', 'learning_resources'])(
    'reports %s read failures instead of inventing defaults',
    async (table) => {
      const db = database()
      db.results[table] = {
        data: null,
        error: { code: '42501', message: 'private database detail' },
      }
      await expect(loadRecommendations(db.client, signal())).rejects.toThrow(
        'Recommendations could not be loaded. Check your connection and try again.',
      )
    },
  )
  it('handles missing profiles without creating or updating one', async () => {
    const db = database()
    db.results.student_profiles.data = null
    const result = await loadRecommendations(db.client, signal())
    expect(result.profileMissing).toBe(true)
    expect(result.experienceMissing).toBe(true)
    expect(result.recommendations).toHaveLength(5)
    expect(result.recommendations[0].explanation).toContain(
      'experience level is not set',
    )
    expect(db.from).toHaveBeenCalledTimes(3)
  })
  it('handles no assessment as neutral evidence, while still using saved preferences', async () => {
    const db = database()
    db.results.assessment_attempts.data = null
    const result = await loadRecommendations(db.client, signal())
    expect(result.assessmentStatus).toBe('missing')
    expect(
      result.recommendations.every(
        (row) => row.components.knowledgeGapRelevance === 0.5,
      ),
    ).toBe(true)
    expect(result.recommendations[0].topic).toBe('budgeting')
  })
  it('handles missing, zero-total, and malformed topics without failing the whole ranking', async () => {
    const db = database()
    db.results.assessment_attempts.data = {
      student_id: db.studentId,
      completed_at: '2026-10-21T12:00:00Z',
      topic_scores: {
        budgeting: { correct: 0, total: 0 },
        saving: 'bad',
        credit: { correct: 1, total: 2 },
      },
    }
    const result = await loadRecommendations(db.client, signal())
    expect(result.assessmentStatus).toBe('partial')
    expect(result.recommendations).toHaveLength(5)
    expect(
      result.recommendations.find((row) => row.topic === 'budgeting')
        ?.components.knowledgeGapRelevance,
    ).toBe(0.5)
  })
  it('does not use scores from an invalid or incomplete attempt', async () => {
    const db = database()
    db.results.assessment_attempts.data = {
      student_id: db.studentId,
      completed_at: null,
      topic_scores: { budgeting: { correct: 0, total: 2 } },
    }
    const result = await loadRecommendations(db.client, signal())
    expect(result.assessmentStatus).toBe('missing')
    expect(
      result.recommendations.every(
        (row) => row.components.knowledgeGapRelevance === 0.5,
      ),
    ).toBe(true)
  })
  it('rejects mismatched profile ownership even if an unexpected API response supplies it', async () => {
    const db = database()
    db.results.student_profiles.data = { id: 'other-student' }
    await expect(loadRecommendations(db.client, signal())).rejects.toThrow(
      'Recommendations could not be loaded',
    )
  })
  it('rejects mismatched assessment ownership even if an unexpected API response supplies it', async () => {
    const db = database()
    db.results.assessment_attempts.data = {
      student_id: 'other-student',
      completed_at: '2026-10-21T12:00:00Z',
    }
    await expect(loadRecommendations(db.client, signal())).rejects.toThrow(
      'Recommendations could not be loaded',
    )
  })
  it('handles empty active catalogs without failure', async () => {
    const db = database()
    db.results.learning_resources.data = []
    expect(
      (await loadRecommendations(db.client, signal())).recommendations,
    ).toEqual([])
  })
  it('does not authenticate or query when already aborted', async () => {
    const db = database()
    const controller = new AbortController()
    controller.abort()
    await expect(
      loadRecommendations(db.client, controller.signal),
    ).rejects.toThrow('Recommendations could not be loaded')
    expect(db.getUser).not.toHaveBeenCalled()
    expect(db.from).not.toHaveBeenCalled()
  })
  it('does not query after cancellation during identity verification', async () => {
    const db = database()
    const controller = new AbortController()
    db.getUser.mockImplementation(async () => {
      controller.abort()
      return { data: { user: { id: db.studentId } }, error: null }
    })
    await expect(
      loadRecommendations(db.client, controller.signal),
    ).rejects.toThrow('Recommendations could not be loaded')
    expect(db.from).not.toHaveBeenCalled()
  })
  it('scopes both private reads to the currently verified account, not a previous one', async () => {
    const db = database()
    db.getUser.mockResolvedValue({
      data: { user: { id: 'new-verified-student' } },
      error: null,
    })
    db.results.student_profiles.data = {
      id: 'new-verified-student',
      interests: ['saving'],
      experience_level: 'beginner',
    }
    db.results.assessment_attempts.data = null
    const result = await loadRecommendations(db.client, signal())
    expect(result.studentId).toBe('new-verified-student')
    expect(
      db.queries.get('student_profiles')?.eq,
    ).toHaveBeenCalledExactlyOnceWith('id', 'new-verified-student')
    expect(
      db.queries.get('assessment_attempts')?.eq,
    ).toHaveBeenCalledExactlyOnceWith('student_id', 'new-verified-student')
  })
})
