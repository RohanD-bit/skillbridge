import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { User } from '@supabase/supabase-js'
import { App } from '../app/App'
import { AuthContext } from '../auth/auth-context'
import type { AuthContextValue } from '../auth/auth-context'
import { fixtureQuestions, fixtureResult } from '../assessment/test-fixtures'
import { AssessmentError } from '../assessment/assessment-api'
import { AssessmentPage } from './AssessmentPage'
import type { AssessmentResult } from '../assessment/types'

const mock = vi.hoisted(() => ({
  latest: vi.fn(),
  questions: vi.fn(),
  submit: vi.fn(),
}))
vi.mock('../lib/supabase', () => ({ supabase: {}, authRedirectError: null }))
vi.mock('../assessment/assessment-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../assessment/assessment-api')>()),
  getLatestAssessment: mock.latest,
  getAssessmentQuestions: mock.questions,
  submitAssessment: mock.submit,
}))
function auth(userId: string | null = 'fixture-student'): AuthContextValue {
  return {
    user: userId ? ({ id: userId } as User) : null,
    session: null,
    loading: false,
    configured: true,
    sessionError: null,
    profile: userId
      ? {
          id: userId,
          interests: [],
          learning_goal: null,
          experience_level: 'beginner',
          created_at: '',
          updated_at: '',
        }
      : null,
    profileLoading: false,
    profileError: null,
    retryProfile: vi.fn(),
    retrySession: vi.fn(),
    signIn: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
  }
}
function visit(user = auth()) {
  return render(
    <AuthContext.Provider value={user}>
      <MemoryRouter initialEntries={['/assessment']}>
        <App />
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}
async function start() {
  fireEvent.click(
    await screen.findByRole('button', { name: 'Start knowledge check' }),
  )
  await screen.findByRole('heading', { name: 'Synthetic question 1' })
}
function choose(letter = 'A') {
  fireEvent.click(
    screen.getByRole('radio', { name: new RegExp('^' + letter + '\\.') }),
  )
}
function answerAll() {
  for (let index = 0; index < 10; index++) {
    choose()
    if (index < 9) fireEvent.click(screen.getByRole('button', { name: 'Next' }))
  }
}
beforeEach(() => {
  vi.resetAllMocks()
  mock.latest.mockResolvedValue(null)
  mock.questions.mockResolvedValue(fixtureQuestions)
  mock.submit.mockResolvedValue(fixtureResult)
})

describe('financial literacy assessment', () => {
  it('protects the assessment from anonymous visitors', async () => {
    visit(auth(null))
    expect(
      await screen.findByRole('heading', { name: 'Welcome back.' }),
    ).toBeTruthy()
    expect(mock.latest).not.toHaveBeenCalled()
    expect(mock.questions).not.toHaveBeenCalled()
  })
  it('shows loading and retry states for saved result failures', async () => {
    mock.latest.mockRejectedValueOnce(
      new AssessmentError('Saved results unavailable.'),
    )
    visit()
    expect(screen.getByRole('status').textContent).toContain(
      'Loading your saved',
    )
    expect((await screen.findByRole('alert')).textContent).toContain(
      'Saved results unavailable',
    )
    fireEvent.click(
      screen.getByRole('button', { name: 'Retry loading results' }),
    )
    expect(
      await screen.findByRole('button', { name: 'Start knowledge check' }),
    ).toBeTruthy()
  })
  it('retries question retrieval without exposing backend errors', async () => {
    mock.questions.mockRejectedValueOnce(new Error('Private server internals'))
    visit()
    fireEvent.click(
      await screen.findByRole('button', { name: 'Start knowledge check' }),
    )
    expect((await screen.findByRole('alert')).textContent).not.toContain(
      'Private server internals',
    )
    fireEvent.click(
      screen.getByRole('button', { name: 'Retry loading questions' }),
    )
    expect(
      await screen.findByRole('heading', { name: 'Synthetic question 1' }),
    ).toBeTruthy()
  })
  it('shows one question at a time and preserves choices in both directions', async () => {
    visit()
    await start()
    expect(screen.getByText('Question 1 of 10')).toBeTruthy()
    expect(screen.getAllByRole('radio')).toHaveLength(4)
    expect(
      screen.queryByRole('heading', { name: 'Synthetic question 2' }),
    ).toBeNull()
    choose('B')
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    choose('C')
    fireEvent.click(screen.getByRole('button', { name: 'Previous' }))
    expect(
      (screen.getByRole('radio', { name: /^B\./ }) as HTMLInputElement).checked,
    ).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(
      (screen.getByRole('radio', { name: /^C\./ }) as HTMLInputElement).checked,
    ).toBe(true)
    expect(screen.getByText('2 of 10 answered')).toBeTruthy()
  })
  it('requires every answer and opens the first unanswered question', async () => {
    visit()
    await start()
    choose()
    fireEvent.click(
      screen.getByRole('button', { name: 'Question 10, unanswered' }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Submit assessment' }))
    expect((await screen.findByRole('alert')).textContent).toContain(
      'answer all 10',
    )
    expect(
      screen.getByRole('heading', { name: 'Synthetic question 2' }),
    ).toBeTruthy()
    expect(document.activeElement).toBe(screen.getByRole('alert'))
    expect(mock.submit).not.toHaveBeenCalled()
  })
  it('submits only choices once and displays the saved overall and topic scores', async () => {
    visit()
    await start()
    answerAll()
    fireEvent.click(screen.getByRole('button', { name: 'Submit assessment' }))
    expect(await screen.findByText('6 / 10 correct · 60%')).toBeTruthy()
    expect(mock.submit).toHaveBeenCalledExactlyOnceWith(
      expect.anything(),
      fixtureQuestions.map((question) => ({
        question_id: question.id,
        answer: 'A',
      })),
      expect.any(AbortSignal),
    )
    const row = screen.getByRole('row', { name: /Budgeting/ })
    expect(within(row).getByText('2 / 3')).toBeTruthy()
    expect(within(row).getByText('More practice may help.')).toBeTruthy()
    expect(
      screen.getByText(/not a comprehensive financial literacy evaluation/),
    ).toBeTruthy()
    expect(
      screen
        .getByRole('link', { name: 'Continue to recommendations' })
        .getAttribute('href'),
    ).toBe('/recommendations')
  })
  it('prevents duplicate submissions while the response is pending', async () => {
    let finish: (result: AssessmentResult) => void = () => {}
    mock.submit.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )
    visit()
    await start()
    answerAll()
    const form = screen
      .getByRole('button', { name: 'Submit assessment' })
      .closest('form')!
    fireEvent.submit(form)
    fireEvent.submit(form)
    expect(mock.submit).toHaveBeenCalledTimes(1)
    expect(
      screen
        .getByRole('button', { name: 'Submitting assessment…' })
        .closest('fieldset')?.disabled,
    ).toBe(true)
    expect(screen.getByRole('status').textContent).toContain('Securely scoring')
    await act(async () => finish(fixtureResult))
    expect(await screen.findByText('6 / 10 correct · 60%')).toBeTruthy()
  })
  it('retains answers after submission/network failure and can recover a saved attempt', async () => {
    mock.submit.mockRejectedValue(
      new AssessmentError('Submission could not be confirmed.'),
    )
    visit()
    await start()
    answerAll()
    fireEvent.click(screen.getByRole('button', { name: 'Submit assessment' }))
    expect((await screen.findByRole('alert')).textContent).toContain(
      'answers are still here',
    )
    expect(
      (screen.getByRole('radio', { name: /^A\./ }) as HTMLInputElement).checked,
    ).toBe(true)
    mock.latest.mockResolvedValue(fixtureResult)
    fireEvent.click(screen.getByRole('button', { name: 'Check saved results' }))
    expect(await screen.findByText('6 / 10 correct · 60%')).toBeTruthy()
    expect(mock.submit).toHaveBeenCalledTimes(1)
  })
  it('restores the latest saved result on a fresh page mount', async () => {
    mock.latest.mockResolvedValue(fixtureResult)
    const first = visit()
    await screen.findByText('6 / 10 correct · 60%')
    first.unmount()
    visit()
    expect(await screen.findByText('6 / 10 correct · 60%')).toBeTruthy()
    expect(mock.latest).toHaveBeenCalledWith(
      expect.anything(),
      'fixture-student',
      expect.any(AbortSignal),
    )
    expect(mock.questions).not.toHaveBeenCalled()
  })
  it('supports retakes without mistaking the previous attempt for a newly saved result', async () => {
    mock.latest.mockResolvedValue(fixtureResult)
    mock.submit.mockRejectedValue(new AssessmentError('Submission failed.'))
    visit()
    fireEvent.click(
      await screen.findByRole('button', { name: 'Take the assessment again' }),
    )
    await screen.findByRole('heading', { name: 'Synthetic question 1' })
    answerAll()
    fireEvent.click(screen.getByRole('button', { name: 'Submit assessment' }))
    await screen.findByRole('alert')
    fireEvent.click(screen.getByRole('button', { name: 'Check saved results' }))
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain(
        'No new saved result',
      ),
    )
    expect(screen.queryByText('6 / 10 correct · 60%')).toBeNull()
  })
  it('discards late results after an account switch', async () => {
    let finish: (result: AssessmentResult | null) => void = () => {}
    mock.latest.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )
    const view = render(
      <AuthContext.Provider value={auth()}>
        <MemoryRouter>
          <AssessmentPage />
        </MemoryRouter>
      </AuthContext.Provider>,
    )
    mock.latest.mockResolvedValue(null)
    view.rerender(
      <AuthContext.Provider value={auth('other-student')}>
        <MemoryRouter>
          <AssessmentPage />
        </MemoryRouter>
      </AuthContext.Provider>,
    )
    await screen.findByRole('button', { name: 'Start knowledge check' })
    await act(async () => finish(fixtureResult))
    expect(screen.queryByText('6 / 10 correct · 60%')).toBeNull()
  })
})
