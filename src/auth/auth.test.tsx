import { StrictMode } from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Session } from '@supabase/supabase-js'
import { App } from '../app/App'
import { AuthProvider } from './AuthProvider'
import { useAuth } from './auth-context'
import { authErrorMessage } from './auth-errors'

const mock = vi.hoisted(() => ({
  session: null as Session | null,
  listener: null as ((event: string, session: Session | null) => void) | null,
  configured: true,
  getSession: vi.fn(),
  signIn: vi.fn(),
  signUp: vi.fn(),
  signOut: vi.fn(),
  profile: vi.fn(),
  unsubscribe: vi.fn(),
}))
vi.mock('../lib/supabase', () => ({
  get supabase() {
    return mock.configured
      ? {
          auth: {
            getSession: mock.getSession,
            onAuthStateChange: (listener: typeof mock.listener) => {
              mock.listener = listener
              return {
                data: { subscription: { unsubscribe: mock.unsubscribe } },
              }
            },
            signInWithPassword: mock.signIn,
            signUp: mock.signUp,
            signOut: mock.signOut,
          },
        }
      : null
  },
  authRedirectError: null,
}))
vi.mock('./student-profile', () => ({ ensureStudentProfile: mock.profile }))
vi.mock('../assessment/assessment-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../assessment/assessment-api')>()),
  getLatestAssessment: vi.fn(async () => null),
}))
vi.mock('../onboarding/profile-preferences', () => ({
  loadStudentPreferences: vi.fn(async () => ({
    id: 'fixture-student',
    interests: [],
    learning_goal: null,
    experience_level: 'beginner',
  })),
  saveStudentPreferences: vi.fn(),
}))

const student = { user: { id: 'fixture-student' } } as Session
const profile = {
  id: 'fixture-student',
  interests: [],
  learning_goal: null,
  experience_level: null,
}
function visit(path = '/login') {
  return render(
    <StrictMode>
      <MemoryRouter initialEntries={[path]}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </MemoryRouter>
    </StrictMode>,
  )
}
async function fillAccountForm() {
  fireEvent.change(await screen.findByLabelText('Email address'), {
    target: { value: 'student@example.test' },
  })
  fireEvent.change(screen.getByLabelText('Password'), {
    target: { value: 'test-only-password' },
  })
}
beforeEach(() => {
  vi.resetAllMocks()
  mock.configured = true
  mock.session = null
  mock.listener = null
  mock.getSession.mockImplementation(async () => ({
    data: { session: mock.session },
    error: null,
  }))
  mock.profile.mockResolvedValue(profile)
  mock.signIn.mockImplementation(async () => {
    mock.listener?.('SIGNED_IN', student)
    return { data: { session: student }, error: null }
  })
  mock.signUp.mockResolvedValue({ data: { session: null }, error: null })
  mock.signOut.mockImplementation(async () => {
    mock.listener?.('SIGNED_OUT', null)
    return { error: null }
  })
})

describe('authentication routes and forms', () => {
  it.each(['/onboarding', '/assessment', '/recommendations'])(
    'redirects an anonymous student from %s to login',
    async (path) => {
      visit(path)
      expect(
        await screen.findByRole('heading', { name: 'Welcome back.' }),
      ).toBeTruthy()
      expect(mock.profile).not.toHaveBeenCalled()
    },
  )
  it('keeps resource search public', async () => {
    visit('/resources')
    expect(
      await screen.findByRole('heading', {
        name: 'Curiosity looks good on you.',
      }),
    ).toBeTruthy()
  })
  it('logs in and returns to the requested protected page', async () => {
    visit('/assessment')
    await fillAccountForm()
    fireEvent.click(screen.getByRole('button', { name: 'Log in' }))
    expect(
      await screen.findByRole('heading', { name: 'Find your starting point.' }),
    ).toBeTruthy()
    expect(mock.signIn).toHaveBeenCalledWith({
      email: 'student@example.test',
      password: 'test-only-password',
    })
    expect(mock.profile).toHaveBeenCalledWith(
      expect.anything(),
      student.user.id,
      expect.any(AbortSignal),
    )
  })
  it('shows safe invalid credential errors and clears the password', async () => {
    mock.signIn.mockResolvedValue({
      error: {
        code: 'invalid_credentials',
        message: 'Do not display raw error',
      },
    })
    visit()
    await fillAccountForm()
    fireEvent.click(screen.getByRole('button', { name: 'Log in' }))
    expect((await screen.findByRole('alert')).textContent).toContain(
      'email or password is incorrect',
    )
    expect((screen.getByLabelText('Password') as HTMLInputElement).value).toBe(
      '',
    )
    expect(screen.queryByText('Do not display raw error')).toBeNull()
  })
  it('shows confirmation instructions without creating a profile before confirmation', async () => {
    visit('/register')
    await fillAccountForm()
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }))
    await waitFor(() =>
      expect(screen.getByRole('status').textContent).toContain(
        'Check your inbox',
      ),
    )
    expect(mock.signUp).toHaveBeenCalledWith(
      expect.objectContaining({
        options: { emailRedirectTo: 'http://localhost:3000/onboarding' },
      }),
    )
    expect(mock.profile).not.toHaveBeenCalled()
  })
  it('opens onboarding if signup immediately supplies a session', async () => {
    mock.signUp.mockImplementation(async () => {
      mock.listener?.('SIGNED_IN', student)
      return { data: { session: student }, error: null }
    })
    visit('/register')
    await fillAccountForm()
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }))
    expect(
      await screen.findByRole('heading', {
        name: 'Make your learning path yours.',
      }),
    ).toBeTruthy()
  })
  it('restores a saved session and retrieves its profile', async () => {
    mock.session = student
    visit('/assessment')
    expect(
      await screen.findByRole('heading', { name: 'Find your starting point.' }),
    ).toBeTruthy()
    expect(mock.getSession).toHaveBeenCalled()
    expect(mock.profile).toHaveBeenCalled()
  })
  it('logs out and removes protected content', async () => {
    mock.session = student
    visit('/assessment')
    fireEvent.click(await screen.findByRole('button', { name: 'Log out' }))
    expect(
      await screen.findByRole('heading', { name: 'Welcome back.' }),
    ).toBeTruthy()
    expect(mock.signOut).toHaveBeenCalledWith({ scope: 'local' })
    expect(
      screen.queryByRole('heading', { name: 'Find your starting point.' }),
    ).toBeNull()
  })
  it('keeps the session and offers an error if logout fails', async () => {
    mock.session = student
    mock.signOut.mockResolvedValue({ error: new TypeError('Failed to fetch') })
    visit('/assessment')
    await screen.findByRole('heading', { name: 'Find your starting point.' })
    fireEvent.click(screen.getByRole('button', { name: 'Log out' }))
    expect((await screen.findByRole('alert')).textContent).toContain(
      'Check your connection',
    )
    expect(
      screen.getByRole('heading', { name: 'Find your starting point.' }),
    ).toBeTruthy()
  })
  it('blocks protected content and allows retry when profile loading fails', async () => {
    mock.session = student
    mock.profile.mockRejectedValueOnce(new Error('offline'))
    visit('/assessment')
    expect((await screen.findByRole('alert')).textContent).toContain(
      'student profile',
    )
    expect(
      screen.queryByRole('heading', { name: 'Find your starting point.' }),
    ).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Retry profile' }))
    expect(
      await screen.findByRole('heading', { name: 'Find your starting point.' }),
    ).toBeTruthy()
  })
  it('handles missing configuration without enabling credential submission', async () => {
    mock.configured = false
    visit()
    expect((await screen.findByRole('alert')).textContent).toContain(
      '.env.local',
    )
    expect(
      (screen.getByRole('button', { name: 'Log in' }) as HTMLButtonElement)
        .disabled,
    ).toBe(false)
    expect(
      screen.getByRole('button', { name: 'Log in' }).closest('fieldset')
        ?.disabled,
    ).toBe(true)
    expect(mock.getSession).not.toHaveBeenCalled()
  })
  it('recovers from session restore failure', async () => {
    mock.getSession.mockRejectedValue(new TypeError('offline'))
    visit('/assessment')
    expect((await screen.findByRole('alert')).textContent).toContain(
      'restore your session',
    )
    mock.getSession.mockResolvedValue({ data: { session: null }, error: null })
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(
      await screen.findByRole('heading', { name: 'Welcome back.' }),
    ).toBeTruthy()
  })
  it('unsubscribes when unmounted', async () => {
    const view = visit()
    await screen.findByRole('heading', { name: 'Welcome back.' })
    const before = mock.unsubscribe.mock.calls.length
    view.unmount()
    expect(mock.unsubscribe.mock.calls.length).toBe(before + 1)
  })
  it('shows pending status and prevents repeated submissions', async () => {
    mock.signIn.mockImplementation(() => new Promise(() => {}))
    visit()
    await fillAccountForm()
    fireEvent.click(screen.getByRole('button', { name: 'Log in' }))
    expect(await screen.findByRole('status')).toBeTruthy()
    expect(
      screen.getByRole('button', { name: 'Logging in…' }).closest('fieldset')
        ?.disabled,
    ).toBe(true)
    expect(mock.signIn).toHaveBeenCalledTimes(1)
  })
})

describe('session and profile races', () => {
  it('does not hide session restore errors after the initial null event', async () => {
    let fail: (error: Error) => void = () => {}
    mock.getSession.mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          fail = reject
        }),
    )
    visit('/assessment')
    await act(async () => {
      mock.listener?.('INITIAL_SESSION', null)
      fail(new TypeError('offline'))
    })
    expect((await screen.findByRole('alert')).textContent).toContain(
      'restore your session',
    )
  })
  it('never exposes the previous profile when switching accounts', async () => {
    mock.session = student
    function Probe() {
      const auth = useAuth()
      return <p>{`${auth.user?.id ?? 'none'}:${auth.profile?.id ?? 'none'}`}</p>
    }
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    )
    await screen.findByText('fixture-student:fixture-student')
    mock.profile.mockImplementation(() => new Promise(() => {}))
    await act(async () => {
      mock.listener?.('SIGNED_IN', { user: { id: 'fixture-other' } } as Session)
    })
    expect(screen.getByText('fixture-other:none')).toBeTruthy()
    expect(screen.queryByText('fixture-other:fixture-student')).toBeNull()
  })
  it('does not replace a new sign-in with an older session lookup', async () => {
    let finish: (value: {
      data: { session: Session | null }
      error: null
    }) => void = () => {}
    mock.getSession.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )
    visit('/assessment')
    await act(async () => {
      mock.listener?.('SIGNED_IN', student)
    })
    await screen.findByRole('heading', { name: 'Find your starting point.' })
    await act(async () => {
      finish({ data: { session: null }, error: null })
    })
    expect(
      screen.getByRole('heading', { name: 'Find your starting point.' }),
    ).toBeTruthy()
  })
  it('discards a profile request that finishes after sign-out', async () => {
    let finish: (value: typeof profile) => void = () => {}
    mock.session = student
    mock.profile.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )
    visit('/assessment')
    await waitFor(() => expect(mock.profile).toHaveBeenCalled())
    await act(async () => {
      mock.listener?.('SIGNED_OUT', null)
    })
    await act(async () => {
      finish(profile)
    })
    expect(
      await screen.findByRole('heading', { name: 'Welcome back.' }),
    ).toBeTruthy()
  })
  it('refreshes session state without re-fetching the same user’s profile', async () => {
    mock.session = student
    function Probe() {
      const auth = useAuth()
      return <p>{auth.profile?.id ?? 'waiting'}</p>
    }
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    )
    await screen.findByText(student.user.id)
    const calls = mock.profile.mock.calls.length
    await act(async () => {
      mock.listener?.('TOKEN_REFRESHED', { ...student })
    })
    expect(mock.profile).toHaveBeenCalledTimes(calls)
  })
})

describe('safe authentication errors', () => {
  it.each([
    [{ code: 'email_not_confirmed' }, 'confirm your email'],
    [new TypeError('fetch failed'), 'Check your connection'],
    [{ status: 429 }, 'Too many attempts'],
    [{ code: 'weak_password' }, 'stronger password'],
    [{ message: 'private server internals' }, 'We couldn’t complete'],
  ])('maps errors without rendering raw details', (error, message) => {
    expect(authErrorMessage(error)).toContain(message)
  })
})
