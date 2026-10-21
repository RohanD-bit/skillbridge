import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { User } from '@supabase/supabase-js'
import { App } from '../app/App'
import { AuthContext } from '../auth/auth-context'
import type { AuthContextValue } from '../auth/auth-context'
import type { StudentProfile } from '../auth/student-profile'
import { OnboardingPage } from './OnboardingPage'

const mock = vi.hoisted(() => ({
  load: vi.fn(),
  save: vi.fn(),
  retryProfile: vi.fn(),
}))
vi.mock('../lib/supabase', () => ({ supabase: {}, authRedirectError: null }))
vi.mock('../assessment/assessment-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../assessment/assessment-api')>()),
  getLatestAssessment: vi.fn(async () => null),
}))
vi.mock('../onboarding/profile-preferences', () => ({
  loadStudentPreferences: mock.load,
  saveStudentPreferences: mock.save,
}))
const profile: StudentProfile = {
  id: 'fixture-student',
  interests: [],
  learning_goal: null,
  experience_level: 'beginner',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}
function context(userId: string | null = profile.id): AuthContextValue {
  return {
    user: userId ? ({ id: userId } as User) : null,
    session: null,
    loading: false,
    configured: true,
    sessionError: null,
    profile: userId ? { ...profile, id: userId } : null,
    profileLoading: false,
    profileError: null,
    retryProfile: mock.retryProfile,
    retrySession: vi.fn(),
    signIn: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
  }
}
function visit(auth = context()) {
  return render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={['/onboarding']}>
        <App />
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}
async function fillForm() {
  fireEvent.click(await screen.findByRole('checkbox', { name: /Budgeting/ }))
  fireEvent.click(screen.getByRole('checkbox', { name: /Saving/ }))
  fireEvent.change(
    screen.getByRole('textbox', { name: /Your primary learning goal/ }),
    { target: { value: 'Learn to plan a budget.' } },
  )
  fireEvent.click(screen.getByRole('radio', { name: /Intermediate/ }))
}
beforeEach(() => {
  vi.resetAllMocks()
  mock.load.mockResolvedValue(profile)
  mock.save.mockResolvedValue({
    ...profile,
    interests: ['budgeting', 'saving'],
    learning_goal: 'Learn to plan a budget.',
    experience_level: 'intermediate',
  })
})

describe('onboarding form', () => {
  it('shows a loading state until preferences have loaded', async () => {
    let resolve: (value: StudentProfile) => void = () => {}
    mock.load.mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done
        }),
    )
    visit()
    expect(screen.getByRole('status').textContent).toContain(
      'Loading your learning preferences',
    )
    expect(
      screen.queryByRole('button', { name: 'Save and continue' }),
    ).toBeNull()
    await act(async () => resolve(profile))
    expect(
      await screen.findByRole('button', { name: 'Save and continue' }),
    ).toBeTruthy()
  })
  it('restores existing preferences and deduplicates loaded interests', async () => {
    mock.load.mockResolvedValue({
      ...profile,
      interests: ['saving', 'saving', 'credit'],
      learning_goal: 'My saved learning goal',
      experience_level: 'advanced',
    })
    visit()
    const saving = (await screen.findByRole('checkbox', {
      name: /Saving/,
    })) as HTMLInputElement
    expect(saving.checked).toBe(true)
    expect(
      (screen.getByRole('checkbox', { name: /Credit/ }) as HTMLInputElement)
        .checked,
    ).toBe(true)
    expect(
      (screen.getByRole('radio', { name: /Advanced/ }) as HTMLInputElement)
        .checked,
    ).toBe(true)
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe(
      'My saved learning goal',
    )
    expect(mock.save).not.toHaveBeenCalled()
  })
  it('reports required fields, focuses the summary, and does not save invalid data', async () => {
    visit()
    fireEvent.click(
      await screen.findByRole('button', { name: 'Save and continue' }),
    )
    const summary = await screen.findByRole('alert')
    expect(summary.textContent).toContain('Choose at least one')
    expect(summary.textContent).toContain('Tell us what')
    expect(document.activeElement).toBe(summary)
    expect(mock.save).not.toHaveBeenCalled()
  })
  it('prevents duplicate selections and saves multiple interests', async () => {
    visit()
    await fillForm()
    const checkbox = screen.getByRole('checkbox', { name: /Saving/ })
    fireEvent.click(checkbox)
    fireEvent.click(checkbox)
    fireEvent.click(screen.getByRole('button', { name: 'Save and continue' }))
    await screen.findByRole('heading', { name: 'Find your starting point.' })
    expect(mock.save).toHaveBeenCalledExactlyOnceWith(
      expect.anything(),
      profile.id,
      {
        interests: ['budgeting', 'saving'],
        learning_goal: 'Learn to plan a budget.',
        experience_level: 'intermediate',
      },
      expect.any(AbortSignal),
    )
    expect(screen.getByText(/Your learning preferences are saved/)).toBeTruthy()
    expect(mock.retryProfile).toHaveBeenCalledTimes(1)
  })
  it('waits for save success before navigation and blocks duplicate submissions', async () => {
    let resolve: (value: StudentProfile) => void = () => {}
    mock.save.mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done
        }),
    )
    visit()
    await fillForm()
    const button = screen.getByRole('button', { name: 'Save and continue' })
    const form = button.closest('form')!
    fireEvent.submit(form)
    fireEvent.submit(form)
    expect(
      screen.queryByRole('heading', { name: 'Find your starting point.' }),
    ).toBeNull()
    expect(
      screen
        .getByRole('button', { name: 'Saving preferences…' })
        .closest('fieldset')?.disabled,
    ).toBe(true)
    expect(mock.save).toHaveBeenCalledTimes(1)
    await act(async () => resolve(profile))
    expect(
      await screen.findByRole('heading', { name: 'Find your starting point.' }),
    ).toBeTruthy()
  })
  it('retains entered values and stays on onboarding after a save failure, then retries', async () => {
    mock.save.mockRejectedValueOnce(new Error('Private database error'))
    visit()
    await fillForm()
    fireEvent.click(screen.getByRole('button', { name: 'Save and continue' }))
    expect((await screen.findByRole('alert')).textContent).toContain(
      'couldn’t confirm',
    )
    expect(screen.queryByText('Private database error')).toBeNull()
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe(
      'Learn to plan a budget.',
    )
    expect(mock.retryProfile).not.toHaveBeenCalled()
    expect(
      screen.queryByRole('heading', { name: 'Find your starting point.' }),
    ).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Save and continue' }))
    expect(
      await screen.findByRole('heading', { name: 'Find your starting point.' }),
    ).toBeTruthy()
  })
  it('shows a load error and retries without exposing a blank writable form', async () => {
    mock.load.mockRejectedValueOnce(new TypeError('offline'))
    visit()
    expect((await screen.findByRole('alert')).textContent).toContain(
      'couldn’t load',
    )
    expect(screen.queryByRole('textbox')).toBeNull()
    fireEvent.click(
      screen.getByRole('button', { name: 'Retry loading preferences' }),
    )
    expect(await screen.findByRole('textbox')).toBeTruthy()
  })
  it('handles a missing profile with empty editable defaults', async () => {
    mock.load.mockResolvedValue(null)
    visit()
    await waitFor(() =>
      expect(screen.getByRole('status').textContent).toContain(
        'create your profile when you save',
      ),
    )
    expect(
      (screen.getByRole('radio', { name: /Beginner/ }) as HTMLInputElement)
        .checked,
    ).toBe(true)
    await fillForm()
    fireEvent.click(screen.getByRole('button', { name: 'Save and continue' }))
    expect(
      await screen.findByRole('heading', { name: 'Find your starting point.' }),
    ).toBeTruthy()
  })
  it('limits goal length and rejects whitespace-only or oversized goals', async () => {
    visit()
    await fillForm()
    const goal = screen.getByRole('textbox') as HTMLTextAreaElement
    expect(goal.maxLength).toBe(300)
    fireEvent.change(goal, { target: { value: ' '.repeat(3) } })
    fireEvent.click(screen.getByRole('button', { name: 'Save and continue' }))
    expect((await screen.findByRole('alert')).textContent).toContain(
      'Tell us what',
    )
    fireEvent.change(goal, { target: { value: 'a'.repeat(301) } })
    fireEvent.click(screen.getByRole('button', { name: 'Save and continue' }))
    expect((await screen.findByRole('alert')).textContent).toContain(
      '300 characters or fewer',
    )
    expect(mock.save).not.toHaveBeenCalled()
  })
  it('requires a valid experience when an invalid stored value is loaded', async () => {
    mock.load.mockResolvedValue({ ...profile, experience_level: 'expert' })
    visit()
    fireEvent.click(await screen.findByRole('checkbox', { name: /Budgeting/ }))
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'A valid goal' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save and continue' }))
    expect((await screen.findByRole('alert')).textContent).toContain(
      'valid experience level',
    )
    expect(mock.save).not.toHaveBeenCalled()
  })
  it('loads saved preferences again after a fresh page mount', async () => {
    const first = visit()
    await fillForm()
    fireEvent.click(screen.getByRole('button', { name: 'Save and continue' }))
    await screen.findByRole('heading', { name: 'Find your starting point.' })
    first.unmount()
    mock.load.mockResolvedValue({
      ...profile,
      learning_goal: 'Learn to plan a budget.',
      interests: ['budgeting', 'saving'],
      experience_level: 'intermediate',
    })
    visit()
    expect(
      ((await screen.findByRole('textbox')) as HTMLTextAreaElement).value,
    ).toBe('Learn to plan a budget.')
    expect(
      (screen.getByRole('radio', { name: /Intermediate/ }) as HTMLInputElement)
        .checked,
    ).toBe(true)
  })
  it('redirects anonymous visitors without fetching preferences', async () => {
    visit(context(null))
    expect(
      await screen.findByRole('heading', { name: 'Welcome back.' }),
    ).toBeTruthy()
    expect(mock.load).not.toHaveBeenCalled()
  })
  it('clears the old draft and discards a late save when accounts change', async () => {
    let finishSave: (value: StudentProfile) => void = () => {}
    let signal: AbortSignal | undefined
    mock.save.mockImplementation((_client, _id, _values, requestSignal) => {
      signal = requestSignal
      return new Promise((resolve) => {
        finishSave = resolve
      })
    })
    const view = render(
      <AuthContext.Provider value={context()}>
        <MemoryRouter>
          <OnboardingPage />
        </MemoryRouter>
      </AuthContext.Provider>,
    )
    await fillForm()
    fireEvent.click(screen.getByRole('button', { name: 'Save and continue' }))
    mock.load.mockResolvedValue({
      ...profile,
      id: 'fixture-other',
      learning_goal: 'Other account goal',
    })
    view.rerender(
      <AuthContext.Provider value={context('fixture-other')}>
        <MemoryRouter>
          <OnboardingPage />
        </MemoryRouter>
      </AuthContext.Provider>,
    )
    await waitFor(() =>
      expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe(
        'Other account goal',
      ),
    )
    expect(signal?.aborted).toBe(true)
    await act(async () => finishSave(profile))
    expect(mock.retryProfile).not.toHaveBeenCalled()
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe(
      'Other account goal',
    )
  })
})
