import { describe, expect, it } from 'vitest'
import { resourceFixtures } from '../resources/test-fixtures'
import type { LearningResource } from '../resources/catalog'
import {
  difficultyCompatibility,
  interestGoalAlignment,
  knowledgeGap,
  rankResources,
  topicKnowledgeGaps,
} from './ranking'

const profile = {
  interests: ['budgeting'],
  learning_goal: 'Learn to budget and control spending.',
  experience_level: 'beginner',
}
const scores = {
  budgeting: { correct: 1, total: 3 },
  saving: { correct: 2, total: 2 },
  credit: { correct: 1, total: 3 },
  investing: { correct: 1, total: 2 },
}

describe('knowledge-gap evidence', () => {
  it('calculates one minus accuracy', () => {
    expect(knowledgeGap({ correct: 1, total: 3 })).toBeCloseTo(2 / 3)
    expect(knowledgeGap({ correct: 0, total: 2 })).toBe(1)
    expect(knowledgeGap({ correct: 2, total: 2 })).toBe(0)
  })
  it.each([
    null,
    undefined,
    [],
    'invalid',
    {},
    { correct: 0, total: 0 },
    { correct: 3, total: 2 },
    { correct: -1, total: 2 },
    { correct: 1.5, total: 2 },
    { correct: 1, total: -2 },
    { correct: '1', total: 2 },
    { correct: 1, total: Infinity },
    { correct: NaN, total: 2 },
    { correct: 1, total: 2.5 },
  ])('treats malformed or absent scores as unknown %#', (value) => {
    expect(knowledgeGap(value)).toBeNull()
  })
  it('preserves valid topic evidence while treating missing topics as unknown', () => {
    expect(
      topicKnowledgeGaps({
        saving: { correct: 2, total: 2 },
        credit: { correct: 0, total: 0 },
      }),
    ).toEqual({
      budgeting: null,
      saving: 0,
      credit: null,
      investing: null,
    })
  })
})

describe('difficulty compatibility', () => {
  it.each(['beginner', 'intermediate', 'advanced'] as const)(
    'gives exact %s matches full compatibility',
    (level) => {
      expect(difficultyCompatibility(level, level)).toBe(1)
    },
  )
  it('prefers accessible content and strongly penalizes advanced resources for beginners', () => {
    expect(difficultyCompatibility('beginner', 'beginner')).toBe(1)
    expect(difficultyCompatibility('intermediate', 'beginner')).toBe(0.35)
    expect(difficultyCompatibility('advanced', 'beginner')).toBe(0)
    expect(difficultyCompatibility('beginner', 'intermediate')).toBeGreaterThan(
      difficultyCompatibility('advanced', 'intermediate'),
    )
  })
  it('uses an explicit beginner default when experience is unknown', () => {
    expect(difficultyCompatibility('beginner', null)).toBe(1)
    expect(difficultyCompatibility('advanced', 'unknown')).toBe(0)
  })
})

describe('interest and literal learning-goal alignment', () => {
  it('awards half the alignment component for an interest alone', () => {
    expect(
      interestGoalAlignment(resourceFixtures[0], { interests: ['budgeting'] }),
    ).toEqual({ score: 0.5, interestMatch: true, matchedKeywords: [] })
  })
  it('matches goal keywords case-insensitively to topics without claiming semantic matching', () => {
    expect(
      interestGoalAlignment(resourceFixtures[1], {
        learning_goal: 'Build an EMERGENCY reserve',
      }),
    ).toEqual({
      score: 0.5,
      interestMatch: false,
      matchedKeywords: ['emergency'],
    })
  })
  it('also matches whole words in resource titles or descriptions', () => {
    expect(
      interestGoalAlignment(resourceFixtures[0], {
        learning_goal: 'I want a plan',
      }).matchedKeywords,
    ).toEqual(['plan'])
  })
  it('does not match a keyword substring inside another word', () => {
    expect(
      interestGoalAlignment(resourceFixtures[0], {
        learning_goal: 'budgetary planning',
      }).score,
    ).toBe(0)
  })
  it('caps goal matches at half the component and cannot be boosted by repetition', () => {
    expect(
      interestGoalAlignment(resourceFixtures[0], {
        learning_goal: 'BUDGET budget spending spending plan',
      }).score,
    ).toBe(0.5)
    expect(interestGoalAlignment(resourceFixtures[0], profile).score).toBe(1)
  })
  it('does not reward generic stopwords or duplicate interests', () => {
    expect(
      interestGoalAlignment(resourceFixtures[0], {
        learning_goal: 'I want to learn more about money',
      }).score,
    ).toBe(0)
    expect(
      interestGoalAlignment(resourceFixtures[0], {
        interests: ['budgeting', 'budgeting'],
      }).score,
    ).toBe(0.5)
  })
  it('handles malformed profiles, goals, and interests', () => {
    expect(interestGoalAlignment(resourceFixtures[0], null).score).toBe(0)
    expect(
      interestGoalAlignment(resourceFixtures[0], {
        interests: 'budgeting',
        learning_goal: [],
      }).score,
    ).toBe(0)
  })
})

describe('deterministic top-five ranking', () => {
  it('uses precisely the 45/35/20 formula with normalized components', () => {
    const [result] = rankResources([resourceFixtures[0]], profile, scores)
    expect(result.components.knowledgeGapRelevance).toBeCloseTo(2 / 3)
    expect(result.components.difficultyCompatibility).toBe(1)
    expect(result.components.interestGoalAlignment).toBe(1)
    expect(result.score).toBeCloseTo(0.45 * (2 / 3) + 0.35 + 0.2)
    for (const value of Object.values(result.components)) {
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThanOrEqual(1)
    }
  })
  it('returns five resources in descending score order without mutating inputs', () => {
    const before = structuredClone(resourceFixtures)
    const ranked = rankResources(resourceFixtures, profile, scores)
    expect(ranked).toHaveLength(5)
    expect(new Set(ranked.map((row) => row.id)).size).toBe(5)
    expect(ranked.map((row) => row.score)).toEqual(
      ranked.map((row) => row.score).sort((a, b) => b - a),
    )
    expect(resourceFixtures).toEqual(before)
    expect(ranked[0].title).toBe('Budgeting basics')
  })
  it('produces the same results for identical inputs and reordered catalogs', () => {
    const first = rankResources(resourceFixtures, profile, scores)
    expect(rankResources(resourceFixtures, profile, scores)).toEqual(first)
    expect(
      rankResources([...resourceFixtures].reverse(), profile, scores),
    ).toEqual(first)
  })
  it('breaks exact ties by case-insensitive title then ID', () => {
    const base = resourceFixtures[0]
    const tied = [
      { ...base, id: 'c', title: 'Zebra' },
      { ...base, id: 'b', title: 'alpha' },
      { ...base, id: 'a', title: 'Alpha' },
    ]
    expect(rankResources(tied, null, null).map((row) => row.id)).toEqual([
      'a',
      'b',
      'c',
    ])
    expect(
      rankResources([...tied].reverse(), null, null).map((row) => row.id),
    ).toEqual(['a', 'b', 'c'])
  })
  it('uses neutral knowledge values without inventing a gap when there is no assessment', () => {
    const ranked = rankResources(resourceFixtures, profile, null)
    expect(
      ranked.every((row) => row.components.knowledgeGapRelevance === 0.5),
    ).toBe(true)
    expect(
      ranked.every((row) =>
        row.explanation.includes('no knowledge gap is assumed'),
      ),
    ).toBe(true)
    expect(
      rankResources(resourceFixtures, profile, {
        saving: { correct: 0, total: 0 },
      }),
    ).toEqual(ranked)
  })
  it('retains valid topic gaps even if another topic score is malformed', () => {
    const ranked = rankResources(resourceFixtures.slice(0, 2), profile, {
      budgeting: { correct: 0, total: 3 },
      saving: 'invalid',
    })
    expect(
      ranked.find((row) => row.topic === 'budgeting')?.components
        .knowledgeGapRelevance,
    ).toBe(1)
    expect(
      ranked.find((row) => row.topic === 'saving')?.components
        .knowledgeGapRelevance,
    ).toBe(0.5)
  })
  it('handles missing profiles and empty catalogs', () => {
    expect(rankResources([], profile, scores)).toEqual([])
    const ranked = rankResources(resourceFixtures, null, null)
    expect(ranked).toHaveLength(5)
    expect(ranked[0].difficulty).toBe('beginner')
    expect(ranked[0].explanation).toContain('experience level is not set')
  })
  it('changes ranking meaningfully for different preferences and knowledge gaps', () => {
    const shared = ['budgeting', 'saving', 'credit', 'investing'].map(
      (topic, index) => ({
        ...resourceFixtures[0],
        id: String(index),
        title: `${topic} primer`,
        topic: topic as LearningResource['topic'],
        description: 'A lesson.',
      }),
    )
    const gaps = (weakTopic: string) =>
      Object.fromEntries(
        shared.map((row) => [
          row.topic,
          { correct: row.topic === weakTopic ? 0 : 2, total: 2 },
        ]),
      )
    const first = rankResources(
      shared,
      { experience_level: 'beginner', interests: ['budgeting'] },
      gaps('budgeting'),
    )
    const second = rankResources(
      shared,
      { experience_level: 'beginner', interests: ['investing'] },
      gaps('investing'),
    )
    expect(first[0].topic).toBe('budgeting')
    expect(second[0].topic).toBe('investing')
  })
  it('allows knowledge gaps alone to change ordering', () => {
    const shared = [
      resourceFixtures[0],
      { ...resourceFixtures[0], id: 'saving', topic: 'saving' as const },
    ]
    expect(
      rankResources(shared, null, {
        budgeting: { correct: 0, total: 2 },
        saving: { correct: 2, total: 2 },
      })[0].topic,
    ).toBe('budgeting')
    expect(
      rankResources(shared, null, {
        budgeting: { correct: 2, total: 2 },
        saving: { correct: 0, total: 2 },
      })[0].topic,
    ).toBe('saving')
  })
  it('lets interests alone change the top topic while assessment and difficulty stay equal', () => {
    const shared = [
      { ...resourceFixtures[0], id: 'budget', title: 'Budgeting primer' },
      {
        ...resourceFixtures[0],
        id: 'saving',
        topic: 'saving' as const,
        title: 'Saving primer',
      },
    ]
    expect(
      rankResources(
        shared,
        { interests: ['budgeting'], experience_level: 'beginner' },
        null,
      )[0].topic,
    ).toBe('budgeting')
    expect(
      rankResources(
        shared,
        { interests: ['saving'], experience_level: 'beginner' },
        null,
      )[0].topic,
    ).toBe('saving')
  })
  it('lets experience alone change the best resource difficulty', () => {
    const shared = [
      resourceFixtures[0],
      {
        ...resourceFixtures[0],
        id: 'intermediate',
        difficulty: 'intermediate' as const,
      },
      {
        ...resourceFixtures[0],
        id: 'advanced',
        difficulty: 'advanced' as const,
      },
    ]
    expect(
      rankResources(shared, { experience_level: 'beginner' }, null)[0]
        .difficulty,
    ).toBe('beginner')
    expect(
      rankResources(shared, { experience_level: 'advanced' }, null)[0]
        .difficulty,
    ).toBe('advanced')
  })
  it('lets goal keywords alone change the top topic', () => {
    const shared = [
      {
        ...resourceFixtures[0],
        id: 'budget',
        title: 'Budgeting primer',
        description: 'A lesson.',
      },
      {
        ...resourceFixtures[0],
        id: 'saving',
        topic: 'saving' as const,
        title: 'Saving primer',
        description: 'A lesson.',
      },
    ]
    expect(
      rankResources(shared, { learning_goal: 'Budget my expenses' }, null)[0]
        .topic,
    ).toBe('budgeting')
    expect(
      rankResources(shared, { learning_goal: 'Save for an emergency' }, null)[0]
        .topic,
    ).toBe('saving')
  })
  it('prevents advanced resources from gaining difficulty points for beginners', () => {
    const sameTopic = [
      {
        ...resourceFixtures[0],
        id: 'advanced',
        difficulty: 'advanced' as const,
      },
      resourceFixtures[0],
    ]
    const ranked = rankResources(sameTopic, profile, {
      budgeting: { correct: 0, total: 3 },
    })
    expect(ranked[0].difficulty).toBe('beginner')
    expect(ranked[1].score).toBeCloseTo(0.65)
    expect(ranked[1].explanation).toContain('may be a stretch')
  })
  it('returns explanatory metadata for every ranked resource', () => {
    const [result] = rankResources([resourceFixtures[0]], profile, scores)
    expect(result).toMatchObject({
      id: resourceFixtures[0].id,
      provider: 'Example Learning',
      title: 'Budgeting basics',
      topic: 'budgeting',
      difficulty: 'beginner',
      url: resourceFixtures[0].url,
    })
    expect(result.explanation).toContain('33%')
    expect(result.explanation).toContain('Matches your beginner')
    expect(result.explanation).toContain('selected interests')
    expect(result.explanation).toContain(
      'Learning-goal keyword match: budget, spending',
    )
  })
  it.each([
    'javascript:alert(1)',
    'http://example.test',
    'https://user:password@example.test',
    '',
  ])('excludes resources without a safe HTTPS link: %s', (url) => {
    expect(
      rankResources([{ ...resourceFixtures[0], url }], profile, scores),
    ).toEqual([])
  })
})
