import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import {
  emptyFilters,
  filterResources,
  loadResources,
  safeResourceUrl,
} from './catalog'
import { resourceFixtures } from './test-fixtures'

function database(
  data: unknown = resourceFixtures.map((row) => ({ ...row, is_active: true })),
  error: unknown = null,
) {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    order: vi.fn(() => query),
    abortSignal: vi.fn().mockResolvedValue({ data, error }),
  }
  const from = vi.fn(() => query)
  return { client: { from } as unknown as SupabaseClient, from, query }
}
const signal = () => new AbortController().signal

describe('authenticated catalog data access', () => {
  it('loads all ten active resources with a read-only field projection and cancellation', async () => {
    const db = database()
    const cancellation = signal()
    expect(await loadResources(db.client, cancellation)).toEqual(
      resourceFixtures,
    )
    expect(db.from).toHaveBeenCalledExactlyOnceWith('learning_resources')
    expect(db.query.select).toHaveBeenCalledExactlyOnceWith(
      'id, title, description, provider, topic, difficulty, resource_type, url, is_active',
    )
    expect(db.query.eq).toHaveBeenCalledExactlyOnceWith('is_active', true)
    expect(db.query.order.mock.calls).toEqual([['title'], ['id']])
    expect(db.query.abortSignal).toHaveBeenCalledWith(cancellation)
  })
  it('excludes inactive rows even if an unexpected response includes them', async () => {
    const db = database(
      resourceFixtures.map((row, index) => ({
        ...row,
        is_active: index !== 0,
      })),
    )
    expect(await loadResources(db.client, signal())).toEqual(
      resourceFixtures.slice(1),
    )
  })
  it('supports a genuinely empty library', async () => {
    expect(await loadResources(database([]).client, signal())).toEqual([])
  })
  it('handles nullable descriptions, providers, and links without dropping the resource', async () => {
    const db = database([
      {
        ...resourceFixtures[0],
        description: null,
        provider: null,
        url: null,
        is_active: true,
      },
    ])
    expect(await loadResources(db.client, signal())).toEqual([
      { ...resourceFixtures[0], description: '', provider: '', url: '' },
    ])
  })
  it.each([
    null,
    {},
    [{ ...resourceFixtures[0], is_active: true, topic: 'unknown' }],
    [{ ...resourceFixtures[0], is_active: true, difficulty: 'expert' }],
    [{ ...resourceFixtures[0], is_active: true, resource_type: 'script' }],
  ])('rejects malformed responses %#', async (data) => {
    await expect(
      loadResources(database(data).client, signal()),
    ).rejects.toThrow('unexpected data')
  })
  it('rejects duplicate resource IDs', async () => {
    const row = { ...resourceFixtures[0], is_active: true }
    await expect(
      loadResources(database([row, row]).client, signal()),
    ).rejects.toThrow('unexpected data')
  })
  it('sanitizes permission failures instead of exposing database internals', async () => {
    await expect(
      loadResources(
        database(null, { code: '42501', message: 'private diagnostic' }).client,
        signal(),
      ),
    ).rejects.toThrow('Check your connection')
  })
  it('handles rejected network requests with a safe retry message', async () => {
    const db = database()
    db.query.abortSignal.mockRejectedValue(
      new Error('private network diagnostic'),
    )
    await expect(loadResources(db.client, signal())).rejects.toThrow(
      'The resource library could not be loaded.',
    )
  })
})

describe('literal resource filtering', () => {
  it('matches title or description case-insensitively and trims whitespace', () => {
    expect(
      filterResources(resourceFixtures, {
        ...emptyFilters,
        keyword: '  PLAN  ',
      }).map((row) => row.title),
    ).toEqual(['Budgeting basics', 'A spending plan'])
  })
  it('does not treat SQL filter punctuation or wildcards as executable syntax', () => {
    expect(
      filterResources(resourceFixtures, {
        ...emptyFilters,
        keyword: '%,topic.eq.credit',
      }),
    ).toEqual([])
  })
  it('combines all filters with the keyword', () => {
    expect(
      filterResources(resourceFixtures, {
        keyword: 'spending',
        topic: 'budgeting',
        difficulty: 'beginner',
        resourceType: 'lesson',
      }),
    ).toEqual([resourceFixtures[0]])
  })
})

describe('safe resource URLs', () => {
  it('accepts an absolute HTTPS link', () => {
    expect(
      safeResourceUrl(' https://learning.example.test/a?topic=saving '),
    ).toBe('https://learning.example.test/a?topic=saving')
  })
  it.each([
    'http://example.test',
    'javascript:alert(1)',
    'data:text/html,unsafe',
    '//example.test',
    '/relative',
    'not a URL',
    'https://',
    'https://user:password@example.test',
    'file:///tmp/test',
    '',
  ])('rejects unsafe URL %s', (url) => {
    expect(safeResourceUrl(url)).toBeNull()
  })
})
