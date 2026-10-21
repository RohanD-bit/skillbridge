import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mock = vi.hoisted(() => ({ createClient: vi.fn().mockReturnValue({}) }))
vi.mock('@supabase/supabase-js', () => ({ createClient: mock.createClient }))
beforeEach(() => {
  vi.resetModules()
  vi.stubEnv('VITE_SUPABASE_URL', '')
  vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', '')
  window.history.replaceState(null, '', '/')
})
afterEach(() => {
  vi.unstubAllEnvs()
  window.history.replaceState(null, '', '/')
})

describe('public Supabase configuration', () => {
  it('does not construct a client without configuration', async () => {
    const config = await import('../lib/supabase')
    expect(config.supabase).toBeNull()
    expect(mock.createClient).not.toHaveBeenCalled()
  })
  it.each([
    'sb_secret_fixture_not_a_real_key',
    'eyJfixture.legacy.fixture',
    'sb_publishable_your_public_key_here',
  ])('rejects secret, legacy, or placeholder keys', async (key) => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co')
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', key)
    expect((await import('../lib/supabase')).supabase).toBeNull()
    expect(mock.createClient).not.toHaveBeenCalled()
  })
  it('passes only public configuration and explicit session options to the client', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co')
    vi.stubEnv(
      'VITE_SUPABASE_PUBLISHABLE_KEY',
      'sb_publishable_fixture_not_a_real_key',
    )
    expect((await import('../lib/supabase')).isSupabaseConfigured).toBe(true)
    expect(mock.createClient).toHaveBeenCalledWith(
      'https://example.supabase.co',
      'sb_publishable_fixture_not_a_real_key',
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      },
    )
  })
  it('captures expired confirmation failures without rendering untrusted URL text', async () => {
    window.history.replaceState(
      null,
      '',
      '/login#error=access_denied&error_code=otp_expired&error_description=untrusted-text',
    )
    const { authRedirectError } = await import('../lib/supabase')
    expect(authRedirectError).toContain('invalid or has expired')
    expect(authRedirectError).not.toContain('untrusted-text')
  })
})
