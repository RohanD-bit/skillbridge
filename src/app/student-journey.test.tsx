import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from './App'
import { AuthProvider } from '../auth/AuthProvider'
import { AuthContext } from '../auth/auth-context'
import type { AuthContextValue } from '../auth/auth-context'
import type { StudentProfile } from '../auth/student-profile'
import { fixtureQuestions, fixtureResult } from '../assessment/test-fixtures'
import type { AssessmentResult } from '../assessment/types'
import { resourceFixtures } from '../resources/test-fixtures'

// Only the SDK transport is mocked. Routes, AuthProvider, forms, data readers,
// assessment response parsing, catalog filtering and ranking run unmocked.
// This in-memory scenario is not a live Supabase/RLS/Edge Function test.
const wire = vi.hoisted(() => ({
  session: null as Session | null,
  listener: null as ((event: string, session: Session | null) => void) | null,
  getSession: vi.fn(),
  getUser: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
  from: vi.fn(),
  invoke: vi.fn(),
}))
vi.mock('../lib/supabase', () => ({
  authRedirectError: null,
  supabase: {
    auth: {
      getSession: wire.getSession,
      getUser: wire.getUser,
      signInWithPassword: wire.signIn,
      signOut: wire.signOut,
      onAuthStateChange: (listener: typeof wire.listener) => {
        wire.listener = listener
        return { data: { subscription: { unsubscribe: () => {} } } }
      },
    },
    from: wire.from,
    functions: { invoke: wire.invoke },
  },
}))
type AttemptRow = Omit<AssessmentResult, 'attempt_id' | 'completed_at'> & {
  id: string
  student_id: string
  completed_at: string | null
}
interface ReadLog {
  table: string
  action: string
  projection: string
  filters: [string, unknown][]
  excludes: [string, string, unknown][]
  orders: [string, boolean][]
  limit: number
}
const studentId = 'fixture-student'
const session = { user: { id: studentId } } as Session
const completeProfile: StudentProfile = {
  id: studentId,
  interests: ['saving'],
  learning_goal: 'Learn about emergency savings.',
  experience_level: 'beginner',
  created_at: '2026-10-01T12:00:00Z',
  updated_at: '2026-10-01T12:00:00Z',
}
const retakeResult: AssessmentResult = {
  ...fixtureResult,
  attempt_id: '20000000-0000-4000-8000-000000000002',
  correct_answers: 8,
  completed_at: '2026-10-21T12:00:00Z',
  topic_scores: {
    budgeting: { correct: 1, total: 3 },
    saving: { correct: 2, total: 2 },
    credit: { correct: 3, total: 3 },
    investing: { correct: 2, total: 2 },
  },
}
let profiles: Map<string, StudentProfile>
let attempts: AttemptRow[]
let queries: ReadLog[]
let failures: Set<string>
let submission: AssessmentResult
let submissionFailure: 'before-save' | 'after-save' | null
let questionsFail: boolean
let catalogEmpty: boolean

function attemptRow(result: AssessmentResult, owner = studentId): AttemptRow {
  const { attempt_id, ...score } = result
  return { id: attempt_id, student_id: owner, ...score }
}
function query(table: string) {
  if (
    !['student_profiles', 'assessment_attempts', 'learning_resources'].includes(
      table,
    )
  )
    throw new Error('Unexpected browser table access')
  const log: ReadLog = {
    table,
    action: 'read',
    projection: '',
    filters: [],
    excludes: [],
    orders: [],
    limit: Infinity,
  }
  let values: Record<string, unknown> = {}
  let cancellation: AbortSignal | undefined
  function execute(single: boolean) {
    queries.push(structuredClone(log))
    const failure = `${table}:${log.action}`
    if (failures.delete(failure) || cancellation?.aborted)
      return {
        data: null,
        error: { code: '42501', message: 'PRIVATE_DIAGNOSTIC' },
      }
    const owner = wire.session?.user.id
    if (!owner)
      return { data: null, error: { message: 'Authentication required' } }
    let rows: Record<string, unknown>[] =
      table === 'student_profiles'
        ? [...profiles.values()]
            .filter((row) => row.id === owner)
            .map((row) => ({ ...row }))
        : table === 'assessment_attempts'
          ? attempts
              .filter((row) => row.student_id === owner)
              .map((row) => ({ ...row }))
          : catalogEmpty
            ? []
            : resourceFixtures.map((row) => ({ ...row, is_active: true }))
    rows = rows.filter((row) =>
      log.filters.every(([key, value]) => row[key] === value),
    )
    rows = rows.filter((row) =>
      log.excludes.every(
        ([key, operator, value]) =>
          operator !== 'is' || value !== null || row[key] !== null,
      ),
    )
    if (log.action !== 'read') {
      expect(table).toBe('student_profiles')
      if (log.action === 'update') {
        expect(Object.keys(values).sort()).toEqual([
          'experience_level',
          'interests',
          'learning_goal',
        ])
        rows = rows.map((row) => ({ ...row, ...values }))
      } else {
        expect(values.id).toBe(owner)
        if (profiles.has(owner)) return { data: null, error: { code: '23505' } }
        rows = [
          {
            ...completeProfile,
            id: owner,
            interests: [],
            learning_goal: null,
            ...values,
          },
        ]
      }
      for (const row of rows)
        profiles.set(row.id as string, row as unknown as StudentProfile)
    }
    rows.sort((left, right) => {
      for (const [key, ascending] of log.orders) {
        if (left[key] === right[key]) continue
        if (left[key] === null) return ascending ? 1 : -1
        if (right[key] === null) return ascending ? -1 : 1
        const comparison = String(left[key]) < String(right[key]) ? -1 : 1
        return ascending ? comparison : -comparison
      }
      return 0
    })
    rows = rows.slice(0, log.limit)
    return { data: single ? (rows[0] ?? null) : rows, error: null }
  }
  const chain = {
    select: (projection: string) => {
      log.projection = projection
      return chain
    },
    eq: (key: string, value: unknown) => {
      log.filters.push([key, value])
      return chain
    },
    not: (key: string, operator: string, value: unknown) => {
      log.excludes.push([key, operator, value])
      return chain
    },
    order: (key: string, options?: { ascending?: boolean }) => {
      log.orders.push([key, options?.ascending !== false])
      return chain
    },
    limit: (limit: number) => {
      log.limit = limit
      return chain
    },
    abortSignal: (signal: AbortSignal) => {
      cancellation = signal
      return chain
    },
    insert: (payload: Record<string, unknown>) => {
      log.action = 'insert'
      values = payload
      return chain
    },
    update: (payload: Record<string, unknown>) => {
      log.action = 'update'
      values = payload
      return chain
    },
    maybeSingle: async () => execute(true),
    single: async () => execute(true),
    then: (resolve: (value: ReturnType<typeof execute>) => unknown) =>
      Promise.resolve(execute(false)).then(resolve),
  }
  return chain
}
beforeEach(() => {
  vi.resetAllMocks()
  wire.session = null
  wire.listener = null
  profiles = new Map()
  attempts = []
  queries = []
  failures = new Set()
  submission = fixtureResult
  submissionFailure = null
  questionsFail = false
  catalogEmpty = false
  wire.from.mockImplementation(query)
  wire.getSession.mockImplementation(async () => ({
    data: { session: wire.session },
    error: null,
  }))
  wire.getUser.mockImplementation(async () => ({
    data: { user: wire.session?.user ?? null },
    error: null,
  }))
  wire.signIn.mockImplementation(async () => {
    wire.session = session
    wire.listener?.('SIGNED_IN', session)
    return { data: { session }, error: null }
  })
  wire.signOut.mockImplementation(async () => {
    wire.session = null
    wire.listener?.('SIGNED_OUT', null)
    return { error: null }
  })
  wire.invoke.mockImplementation(
    async (name: string, options: { body: Record<string, unknown> }) => {
      expect(wire.session?.user.id).toBe(studentId)
      if (name === 'assessment-questions') {
        if (questionsFail) {
          questionsFail = false
          return { data: null, error: new TypeError('PRIVATE_DIAGNOSTIC') }
        }
        return { data: { questions: fixtureQuestions }, error: null }
      }
      expect(name).toBe('submit-assessment')
      expect(Object.keys(options.body)).toEqual(['answers'])
      expect(options.body.answers).toHaveLength(10)
      const failure = submissionFailure
      submissionFailure = null
      if (failure !== 'before-save') attempts.push(attemptRow(submission))
      return failure
        ? { data: null, error: new TypeError('PRIVATE_DIAGNOSTIC') }
        : { data: submission, error: null }
    },
  )
})
function visit(path = '/', state?: unknown) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: path, state }]}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>,
  )
}
function returning(withAssessment = true) {
  wire.session = session
  profiles.set(studentId, structuredClone(completeProfile))
  if (withAssessment) attempts.push(attemptRow(fixtureResult))
}
async function login() {
  fireEvent.change(await screen.findByLabelText('Email address'), {
    target: { value: 'student@example.test' },
  })
  fireEvent.change(screen.getByLabelText('Password'), {
    target: { value: 'synthetic-test-password' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Log in' }))
}
function mainLink(name: string) {
  return within(
    screen.getByRole('navigation', { name: 'Main navigation' }),
  ).getByRole('link', { name })
}
async function start() {
  fireEvent.click(
    await screen.findByRole('button', { name: 'Start knowledge check' }),
  )
  await screen.findByRole('heading', { name: 'Synthetic question 1' })
}
function answerAll() {
  for (let index = 0; index < 10; index++) {
    fireEvent.click(screen.getByRole('radio', { name: /^B\./ }))
    if (index < 9) fireEvent.click(screen.getByRole('button', { name: 'Next' }))
  }
  fireEvent.click(screen.getByRole('button', { name: 'Submit assessment' }))
}
async function recommended(title: string) {
  await screen.findByRole('heading', { name: 'Your top 5 resources' })
  await waitFor(() =>
    expect(
      within(screen.getAllByRole('article')[0]).getByRole('heading', {
        name: title,
      }),
    ).toBeTruthy(),
  )
}
async function continueToRecommendations() {
  fireEvent.click(
    await screen.findByRole('link', { name: 'Continue to recommendations' }),
  )
  await screen.findByRole('heading', { name: 'Your top 5 resources' })
}

describe('integrated student journey with mocked SDK transport', () => {
  it('connects login, new-profile onboarding, assessment, recommendations, and catalog filtering', async () => {
    visit()
    await login()
    const interest = await screen.findByRole('checkbox', { name: /Saving/ })
    fireEvent.click(interest)
    fireEvent.change(screen.getByLabelText(/Your primary learning goal/), {
      target: { value: completeProfile.learning_goal },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save and continue' }))
    await start()
    answerAll()
    expect(await screen.findByText('6 / 10 correct · 60%')).toBeTruthy()
    expect(document.activeElement).toBe(
      screen.getByRole('heading', {
        name: 'A starting point for your next step.',
      }),
    )
    await continueToRecommendations()
    await recommended('Build a buffer')
    expect(
      within(screen.getAllByRole('article')[0]).getByText(
        /Learning-goal keyword match: emergency, savings/,
      ),
    ).toBeTruthy()
    fireEvent.click(
      within(
        screen.getByRole('navigation', { name: 'Learning path actions' }),
      ).getByRole('link', { name: 'Explore resources' }),
    )
    await screen.findByText('10 of 10 resources')
    fireEvent.change(screen.getByRole('searchbox'), {
      target: { value: 'EMERGENCY' },
    })
    fireEvent.change(screen.getByRole('combobox', { name: 'Topic' }), {
      target: { value: 'saving' },
    })
    fireEvent.change(screen.getByRole('combobox', { name: 'Resource type' }), {
      target: { value: 'article' },
    })
    expect(screen.getByText('1 of 10 resources')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Clear Filters' }))
    expect(screen.getByText('10 of 10 resources')).toBeTruthy()
    expect(profiles.get(studentId)?.interests).toEqual(['saving'])
    expect(queries.filter((query) => query.action === 'insert')).toHaveLength(1)
    expect(attempts).toHaveLength(1)
  })
  it('restores returning students to the latest completed result without repeating onboarding', async () => {
    returning()
    attempts.push(
      attemptRow(retakeResult),
      { ...attemptRow(retakeResult), id: 'unfinished', completed_at: null },
      {
        ...attemptRow(retakeResult, 'other-student'),
        completed_at: '2026-10-23T12:00:00Z',
      },
    )
    visit()
    expect(await screen.findByText('8 / 10 correct · 80%')).toBeTruthy()
    expect(
      screen.queryByRole('button', { name: 'Save and continue' }),
    ).toBeNull()
    await continueToRecommendations()
    await recommended('Budgeting basics')
    const reads = queries.filter(
      (query) => query.table === 'assessment_attempts',
    )
    expect(reads.length).toBeGreaterThanOrEqual(2)
    for (const read of reads) {
      expect(read.filters).toEqual([['student_id', studentId]])
      expect(read.excludes).toEqual([['completed_at', 'is', null]])
      expect(read.orders).toEqual([
        ['completed_at', false],
        ['id', false],
      ])
      expect(read.limit).toBe(1)
    }
    expect(queries.every((query) => query.action === 'read')).toBe(true)
  })
  it('uses consistent ID tie-breaking when completion times are identical', async () => {
    returning()
    attempts.push(
      attemptRow({ ...retakeResult, completed_at: fixtureResult.completed_at }),
    )
    visit()
    expect(await screen.findByText('8 / 10 correct · 80%')).toBeTruthy()
    await continueToRecommendations()
    await recommended('Budgeting basics')
  })
  it('offers an assessment to a returning student without one and neutral recommendations independently', async () => {
    returning(false)
    visit()
    expect(
      await screen.findByRole('button', { name: 'Start knowledge check' }),
    ).toBeTruthy()
    fireEvent.click(mainLink('For you'))
    expect(
      await screen.findByText(/You have no completed knowledge check yet/),
    ).toBeTruthy()
    expect(
      screen.getByRole('link', { name: 'Take the knowledge check' }),
    ).toBeTruthy()
    expect(screen.getAllByRole('article')).toHaveLength(5)
  })
  it('replaces a previous result and refreshes real ranking inputs after a successful retake', async () => {
    returning()
    visit('/recommendations')
    await recommended('Build a buffer')
    fireEvent.click(
      screen.getByRole('link', { name: 'View results or retake assessment' }),
    )
    await screen.findByText('6 / 10 correct · 60%')
    fireEvent.click(
      screen.getByRole('button', { name: 'Take the assessment again' }),
    )
    await screen.findByRole('heading', { name: 'Synthetic question 1' })
    submission = retakeResult
    answerAll()
    expect(await screen.findByText('8 / 10 correct · 80%')).toBeTruthy()
    expect(screen.queryByText('6 / 10 correct · 60%')).toBeNull()
    await continueToRecommendations()
    await recommended('Budgeting basics')
    expect(
      within(screen.getAllByRole('article')[0]).getByText(/Budgeting was 33%/),
    ).toBeTruthy()
    expect(attempts).toHaveLength(2)
  })
  it('refreshes recommendations on a same-route navigation instead of retaining old data', async () => {
    returning()
    visit('/recommendations')
    await recommended('Build a buffer')
    attempts.push(attemptRow(retakeResult))
    fireEvent.click(mainLink('For you'))
    await recommended('Budgeting basics')
    expect(wire.getUser).toHaveBeenCalledTimes(2)
  })
  it('routes incomplete profiles to onboarding and preserves their saved partial preferences', async () => {
    returning(false)
    profiles.set(studentId, { ...completeProfile, learning_goal: null })
    visit()
    const interest = await screen.findByRole('checkbox', { name: /Saving/ })
    expect((interest as HTMLInputElement).checked).toBe(true)
    expect(
      (
        screen.getByLabelText(
          /Your primary learning goal/,
        ) as HTMLTextAreaElement
      ).value,
    ).toBe('')
    expect(queries.every((query) => query.action === 'read')).toBe(true)
  })
  it('allows an explicit preference edit and uses the updated saved profile in recommendations', async () => {
    returning()
    visit('/recommendations')
    await recommended('Build a buffer')
    fireEvent.click(screen.getByRole('link', { name: 'Edit preferences' }))
    const goal = await screen.findByLabelText(/Your primary learning goal/)
    expect((goal as HTMLTextAreaElement).value).toBe(
      completeProfile.learning_goal,
    )
    fireEvent.click(screen.getByRole('checkbox', { name: /Saving/ }))
    fireEvent.click(screen.getByRole('checkbox', { name: /Budgeting/ }))
    fireEvent.change(goal, {
      target: { value: 'Practice spending and budgeting.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save and continue' }))
    await continueToRecommendations()
    await recommended('Budgeting basics')
    expect(profiles.get(studentId)?.created_at).toBe(completeProfile.created_at)
    expect(profiles.get(studentId)?.interests).toEqual(['budgeting'])
  })
  it('returns library visitors to the library after login', async () => {
    visit('/resources')
    fireEvent.click(
      await screen.findByRole('link', { name: 'Sign in to explore resources' }),
    )
    await login()
    expect(await screen.findByText('10 of 10 resources')).toBeTruthy()
  })
  it('rejects external login redirects and resumes safely inside the application', async () => {
    profiles.set(studentId, completeProfile)
    visit('/login', { from: 'https://untrusted.example.test' })
    await login()
    expect(
      await screen.findByRole('button', { name: 'Start knowledge check' }),
    ).toBeTruthy()
  })
  it('recovers from a profile read failure without overwriting saved preferences', async () => {
    returning()
    failures.add('student_profiles:read')
    visit()
    expect((await screen.findByRole('alert')).textContent).toContain(
      'student profile',
    )
    fireEvent.click(screen.getByRole('button', { name: 'Retry profile' }))
    expect(await screen.findByText('6 / 10 correct · 60%')).toBeTruthy()
    expect(profiles.get(studentId)).toEqual(completeProfile)
    expect(queries.every((query) => query.action === 'read')).toBe(true)
  })
  it('recovers from failed question loading without a deployment or permission change', async () => {
    returning(false)
    questionsFail = true
    visit('/assessment')
    fireEvent.click(
      await screen.findByRole('button', { name: 'Start knowledge check' }),
    )
    expect((await screen.findByRole('alert')).textContent).not.toContain(
      'PRIVATE_DIAGNOSTIC',
    )
    fireEvent.click(
      screen.getByRole('button', { name: 'Retry loading questions' }),
    )
    expect(
      await screen.findByRole('heading', { name: 'Synthetic question 1' }),
    ).toBeTruthy()
  })
  it('keeps answers after a failed submission and can recover a saved response without resubmitting', async () => {
    returning(false)
    visit('/assessment')
    await start()
    submissionFailure = 'after-save'
    answerAll()
    expect((await screen.findByRole('alert')).textContent).toContain(
      'answers are still here',
    )
    expect(
      (screen.getByRole('radio', { name: /^B\./ }) as HTMLInputElement).checked,
    ).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Check saved results' }))
    expect(await screen.findByText('6 / 10 correct · 60%')).toBeTruthy()
    expect(attempts).toHaveLength(1)
    expect(
      wire.invoke.mock.calls.filter(([name]) => name === 'submit-assessment'),
    ).toHaveLength(1)
    await continueToRecommendations()
    await recommended('Build a buffer')
  })
  it('retains quiz answers when submission fails before saving and allows an explicit retry', async () => {
    returning(false)
    visit('/assessment')
    await start()
    submissionFailure = 'before-save'
    answerAll()
    expect((await screen.findByRole('alert')).textContent).toContain(
      'answers are still here',
    )
    expect(attempts).toHaveLength(0)
    expect(
      (screen.getByRole('radio', { name: /^B\./ }) as HTMLInputElement).checked,
    ).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Submit assessment' }))
    expect(await screen.findByText('6 / 10 correct · 60%')).toBeTruthy()
    expect(attempts).toHaveLength(1)
    expect(
      wire.invoke.mock.calls.filter(([name]) => name === 'submit-assessment'),
    ).toHaveLength(2)
  })
  it('keeps a preference draft after a failed save and proceeds only when retry succeeds', async () => {
    returning()
    visit('/onboarding')
    const goal = await screen.findByLabelText(/Your primary learning goal/)
    fireEvent.change(goal, { target: { value: 'My fictional learning goal.' } })
    failures.add('student_profiles:update')
    fireEvent.click(screen.getByRole('button', { name: 'Save and continue' }))
    expect((await screen.findByRole('alert')).textContent).toContain(
      'entries are still here',
    )
    expect(
      (
        screen.getByLabelText(
          /Your primary learning goal/,
        ) as HTMLTextAreaElement
      ).value,
    ).toBe('My fictional learning goal.')
    expect(profiles.get(studentId)?.learning_goal).toBe(
      completeProfile.learning_goal,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Save and continue' }))
    expect(await screen.findByText('6 / 10 correct · 60%')).toBeTruthy()
  })
  it('recovers from a recommendation query failure and keeps independent library navigation available', async () => {
    returning()
    failures.add('assessment_attempts:read')
    visit('/recommendations')
    expect((await screen.findByRole('alert')).textContent).toContain(
      'Recommendations could not be loaded',
    )
    expect(
      screen.getByRole('navigation', { name: 'Learning path actions' }),
    ).toBeTruthy()
    fireEvent.click(
      screen.getByRole('button', { name: 'Retry recommendations' }),
    )
    await recommended('Build a buffer')
  })
  it('handles an empty catalog throughout recommendations and independent exploration', async () => {
    returning()
    catalogEmpty = true
    visit('/recommendations')
    expect(
      await screen.findByRole('heading', {
        name: 'No resources are available to recommend yet.',
      }),
    ).toBeTruthy()
    fireEvent.click(mainLink('Explore resources'))
    expect(
      await screen.findByRole('heading', {
        name: 'The library is getting ready.',
      }),
    ).toBeTruthy()
  })
  it('returns from a not-found page to the saved learning stage rather than forcing onboarding', async () => {
    returning()
    visit('/missing-page')
    fireEvent.click(
      await screen.findByRole('link', { name: 'Back to your learning space' }),
    )
    expect(await screen.findByText('6 / 10 correct · 60%')).toBeTruthy()
  })
  it('clears private results on logout and preserves the protected return destination', async () => {
    returning()
    visit('/assessment')
    await screen.findByText('6 / 10 correct · 60%')
    fireEvent.click(screen.getByRole('button', { name: 'Log out' }))
    expect(
      await screen.findByRole('heading', { name: 'Welcome back.' }),
    ).toBeTruthy()
    expect(screen.queryByText('6 / 10 correct · 60%')).toBeNull()
    await login()
    expect(await screen.findByText('6 / 10 correct · 60%')).toBeTruthy()
  })
  it('gives a resolved missing profile a usable onboarding form instead of an endless spinner', async () => {
    wire.session = session
    const context: AuthContextValue = {
      user: session.user,
      session,
      loading: false,
      sessionError: null,
      configured: true,
      profile: null,
      profileLoading: false,
      profileError: null,
      retryProfile: vi.fn(),
      retrySession: vi.fn(),
      signIn: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
    }
    render(
      <MemoryRouter initialEntries={['/assessment']}>
        <AuthContext.Provider value={context}>
          <App />
        </AuthContext.Provider>
      </MemoryRouter>,
    )
    expect(
      await screen.findByRole('button', { name: 'Save and continue' }),
    ).toBeTruthy()
    expect(
      screen.getByText(/We’ll create your profile when you save/),
    ).toBeTruthy()
    expect(wire.invoke).not.toHaveBeenCalled()
  })
})
