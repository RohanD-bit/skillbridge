import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { ensureStudentProfile } from './student-profile'

const profile = {
  id: 'fixture-user',
  interests: ['saving'],
  learning_goal: 'Existing goal',
  experience_level: 'beginner',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

function fixture() {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    abortSignal: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn(),
    single: vi.fn(),
    insert: vi.fn().mockReturnThis(),
  }
  const client = { from: vi.fn().mockReturnValue(chain) }
  return {
    chain,
    client,
    run: () =>
      ensureStudentProfile(
        client as unknown as SupabaseClient,
        profile.id,
        new AbortController().signal,
      ),
  }
}

describe('student profile initialization', () => {
  it('returns an existing profile without writing to it', async () => {
    const { chain, client, run } = fixture()
    chain.maybeSingle.mockResolvedValue({ data: profile, error: null })
    expect(await run()).toEqual(profile)
    expect(chain.insert).not.toHaveBeenCalled()
    expect(client.from).toHaveBeenCalledWith('student_profiles')
    expect(chain.eq).toHaveBeenCalledWith('id', profile.id)
  })
  it('inserts only the authenticated ID and empty interests when missing', async () => {
    const { chain, run } = fixture()
    chain.maybeSingle.mockResolvedValue({ data: null, error: null })
    chain.single.mockResolvedValue({ data: profile, error: null })
    expect(await run()).toEqual(profile)
    expect(chain.insert).toHaveBeenCalledExactlyOnceWith({
      id: profile.id,
      interests: [],
    })
  })
  it('re-reads after a duplicate insert without overwriting a concurrent profile', async () => {
    const { chain, run } = fixture()
    chain.maybeSingle
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: profile, error: null })
    chain.single.mockResolvedValue({ data: null, error: { code: '23505' } })
    expect(await run()).toEqual(profile)
    expect(chain.insert).toHaveBeenCalledTimes(1)
    expect(chain.maybeSingle).toHaveBeenCalledTimes(2)
  })
  it('does not insert after a read failure, including RLS errors', async () => {
    const { chain, run } = fixture()
    chain.maybeSingle.mockResolvedValue({
      data: null,
      error: { code: '42501' },
    })
    await expect(run()).rejects.toEqual({ code: '42501' })
    expect(chain.insert).not.toHaveBeenCalled()
  })
  it('surfaces insert failures for retry instead of pretending a profile exists', async () => {
    const { chain, run } = fixture()
    chain.maybeSingle.mockResolvedValue({ data: null, error: null })
    chain.single.mockResolvedValue({ data: null, error: { code: '42501' } })
    await expect(run()).rejects.toEqual({ code: '42501' })
  })
})
