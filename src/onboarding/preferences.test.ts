import { describe, expect, it } from 'vitest'
import {
  hasCompletePreferences,
  normalizePreferences,
  validatePreferences,
} from './preferences'

const valid = {
  interests: ['budgeting', 'saving'],
  learning_goal: 'Learn how to plan a budget.',
  experience_level: 'beginner',
}

describe('onboarding validation', () => {
  it('recognizes saved, valid preferences without requiring a new completion flag', () => {
    expect(hasCompletePreferences(valid)).toBe(true)
  })
  it.each([
    null,
    {},
    { ...valid, interests: [] },
    { ...valid, interests: 'saving' },
    { ...valid, interests: [5] },
    { ...valid, learning_goal: null },
    { ...valid, learning_goal: '   ' },
    { ...valid, experience_level: null },
    { ...valid, experience_level: 'expert' },
  ])('does not skip incomplete or malformed onboarding %#', (profile) => {
    expect(hasCompletePreferences(profile)).toBe(false)
  })
  it('accepts multiple allowed interests and every valid experience level', () => {
    for (const experience_level of ['beginner', 'intermediate', 'advanced']) {
      expect(validatePreferences({ ...valid, experience_level })).toEqual({})
    }
  })
  it('requires at least one interest and rejects unsupported topics', () => {
    expect(
      validatePreferences({ ...valid, interests: [] }).interests,
    ).toBeTruthy()
    expect(
      validatePreferences({ ...valid, interests: ['unsupported'] }).interests,
    ).toBeTruthy()
  })
  it('requires a goal with non-whitespace content', () => {
    expect(
      validatePreferences({ ...valid, learning_goal: ' \n\t ' }).learning_goal,
    ).toBeTruthy()
  })
  it('accepts exactly 300 characters and rejects 301', () => {
    expect(
      validatePreferences({ ...valid, learning_goal: 'a'.repeat(300) }),
    ).toEqual({})
    expect(
      validatePreferences({ ...valid, learning_goal: 'a'.repeat(301) })
        .learning_goal,
    ).toBeTruthy()
  })
  it.each(['', 'expert', 'BEGINNER'])(
    'rejects invalid experience values',
    (experience_level) => {
      expect(
        validatePreferences({ ...valid, experience_level }).experience_level,
      ).toBeTruthy()
    },
  )
  it('deduplicates interests and trims the goal before persistence', () => {
    expect(
      normalizePreferences({
        ...valid,
        interests: ['saving', 'saving', 'credit'],
        learning_goal: '  A learning goal  ',
      }),
    ).toEqual({
      interests: ['saving', 'credit'],
      learning_goal: 'A learning goal',
      experience_level: 'beginner',
    })
  })
})
