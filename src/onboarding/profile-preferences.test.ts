import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  loadStudentPreferences,
  saveStudentPreferences,
} from './profile-preferences'

const values = {
  interests: ['budgeting', 'saving'],
  learning_goal: 'Learn to budget.',
  experience_level: 'intermediate',
}
const profile = {
  id: 'fixture-student',
  ...values,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}
function fixture() {
  const chain = {
    select: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    abortSignal: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn(),
    single: vi.fn(),
  }
  const from = vi.fn().mockReturnValue(chain)
  const client = { from } as unknown as SupabaseClient
  const signal = new AbortController().signal
  return {
    chain,
    from,
    signal,
    load: (userId = profile.id) =>
      loadStudentPreferences(client, userId, signal),
    save: (input = values, userId = profile.id) =>
      saveStudentPreferences(client, userId, input, signal),
  }
}

describe('student preference persistence', () => {
  it('loads only the authenticated ID and never writes during load', async () => {
    const { chain, from, signal, load } = fixture()
    chain.maybeSingle.mockResolvedValue({ data: profile, error: null })
    expect(await load()).toEqual(profile)
    expect(from).toHaveBeenCalledExactlyOnceWith('student_profiles')
    expect(chain.eq).toHaveBeenCalledExactlyOnceWith('id', profile.id)
    expect(chain.abortSignal).toHaveBeenCalledWith(signal)
    expect(chain.insert).not.toHaveBeenCalled()
    expect(chain.update).not.toHaveBeenCalled()
  })
  it('returns null for a missing profile', async () => {
    const { chain, load } = fixture()
    chain.maybeSingle.mockResolvedValue({ data: null, error: null })
    expect(await load()).toBeNull()
  })
  it('updates only preferences and preserves created_at and other fields', async () => {
    const { chain, save } = fixture()
    chain.maybeSingle.mockResolvedValue({ data: profile, error: null })
    const saved = await save()
    expect(chain.update).toHaveBeenCalledExactlyOnceWith(values)
    expect(chain.eq).toHaveBeenCalledExactlyOnceWith('id', profile.id)
    expect(saved.created_at).toBe(profile.created_at)
    expect(chain.insert).not.toHaveBeenCalled()
  })
  it('normalizes duplicate topics before sending the update', async () => {
    const { chain, save } = fixture()
    chain.maybeSingle.mockResolvedValue({ data: profile, error: null })
    await save({
      ...values,
      interests: ['saving', 'saving'],
      learning_goal: '  Learn to budget.  ',
    })
    expect(chain.update).toHaveBeenCalledWith({
      ...values,
      interests: ['saving'],
    })
  })
  it('creates a missing profile without supplying timestamps', async () => {
    const { chain, save } = fixture()
    chain.maybeSingle.mockResolvedValue({ data: null, error: null })
    chain.single.mockResolvedValue({ data: profile, error: null })
    expect(await save()).toEqual(profile)
    expect(chain.insert).toHaveBeenCalledExactlyOnceWith({
      id: profile.id,
      ...values,
    })
  })
  it('retries the scoped update after a concurrent insert', async () => {
    const { chain, save } = fixture()
    chain.maybeSingle
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: profile, error: null })
    chain.single.mockResolvedValue({ data: null, error: { code: '23505' } })
    expect(await save()).toEqual(profile)
    expect(chain.update).toHaveBeenCalledTimes(2)
    expect(chain.eq.mock.calls).toEqual([
      ['id', profile.id],
      ['id', profile.id],
    ])
  })
  it('does not attempt an insert after an update permission error', async () => {
    const { chain, save } = fixture()
    chain.maybeSingle.mockResolvedValue({
      data: null,
      error: { code: '42501' },
    })
    await expect(save()).rejects.toEqual({ code: '42501' })
    expect(chain.insert).not.toHaveBeenCalled()
  })
  it('surfaces missing-profile insert failures', async () => {
    const { chain, save } = fixture()
    chain.maybeSingle.mockResolvedValue({ data: null, error: null })
    chain.single.mockResolvedValue({ data: null, error: { code: '42501' } })
    await expect(save()).rejects.toEqual({ code: '42501' })
  })
  it('does not claim success when concurrent retry returns no row', async () => {
    const { chain, save } = fixture()
    chain.maybeSingle.mockResolvedValue({ data: null, error: null })
    chain.single.mockResolvedValue({ data: null, error: { code: '23505' } })
    await expect(save()).rejects.toEqual({ code: '23505' })
  })
  it('rejects another student’s row on both read and save', async () => {
    const { chain, load, save } = fixture()
    chain.maybeSingle.mockResolvedValue({
      data: { ...profile, id: 'other-student' },
      error: null,
    })
    await expect(load()).rejects.toThrow('owner mismatch')
    await expect(save()).rejects.toThrow('owner mismatch')
  })
  it('rejects missing identity without making requests', async () => {
    const { from, load, save } = fixture()
    await expect(load('')).rejects.toThrow('Authentication required')
    await expect(save(values, '')).rejects.toThrow('Authentication required')
    expect(from).not.toHaveBeenCalled()
  })
  it('rejects invalid preferences before any request', async () => {
    const { from, save } = fixture()
    await expect(save({ ...values, learning_goal: ' ' })).rejects.toThrow(
      'Invalid',
    )
    await expect(
      save({ ...values, experience_level: 'expert' }),
    ).rejects.toThrow('Invalid')
    await expect(
      save({ ...values, interests: ['private-topic'] }),
    ).rejects.toThrow('Invalid')
    expect(from).not.toHaveBeenCalled()
  })
  it('surfaces network failures without modifying another row', async () => {
    const { chain, load } = fixture()
    chain.maybeSingle.mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(load()).rejects.toThrow('Failed to fetch')
    expect(chain.update).not.toHaveBeenCalled()
  })
})
