import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { User } from '@supabase/supabase-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from '../app/App'
import { AuthContext } from '../auth/auth-context'
import type { AuthContextValue } from '../auth/auth-context'
import { resourceFixtures } from '../resources/test-fixtures'
import { rankResources } from '../recommendations/ranking'
import { RecommendationError } from '../recommendations/recommendations-api'
import type { RecommendationData } from '../recommendations/recommendations-api'
import { RecommendationsPage } from './RecommendationsPage'

const mock = vi.hoisted(() => ({ load: vi.fn(), configured: true }))
vi.mock('../lib/supabase', () => ({
  get supabase() {
    return mock.configured ? {} : null
  },
  authRedirectError: null,
}))
vi.mock('../recommendations/recommendations-api', async (original) => ({
  ...(await original<
    typeof import('../recommendations/recommendations-api')
  >()),
  loadRecommendations: mock.load,
}))

function fixture(studentId = 'fixture-student'): RecommendationData {
  return {
    studentId,
    profileMissing: false,
    experienceMissing: false,
    assessmentStatus: 'complete',
    recommendations: rankResources(
      resourceFixtures,
      {
        interests: ['budgeting'],
        learning_goal: 'Control spending',
        experience_level: 'beginner',
      },
      {
        budgeting: { correct: 1, total: 3 },
        saving: { correct: 2, total: 2 },
        credit: { correct: 1, total: 3 },
        investing: { correct: 1, total: 2 },
      },
    ),
  }
}
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
function tree(context: AuthContextValue, routed = false) {
  return (
    <AuthContext.Provider value={context}>
      <MemoryRouter initialEntries={['/recommendations']}>
        {routed ? <App /> : <RecommendationsPage />}
      </MemoryRouter>
    </AuthContext.Provider>
  )
}
function visit(context = auth(), routed = false) {
  return render(tree(context, routed))
}
async function loaded() {
  await screen.findByRole('heading', { name: 'Your top 5 resources' })
}
beforeEach(() => {
  vi.resetAllMocks()
  mock.configured = true
  mock.load.mockResolvedValue(fixture())
})

describe('minimal recommendation display', () => {
  it('loads five ranked cards with explanations, scores, metadata, and safe links', async () => {
    let finish: (data: RecommendationData) => void = () => {}
    mock.load.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )
    visit()
    expect(screen.getByRole('status').textContent).toContain(
      'Finding resources',
    )
    await act(async () => finish(fixture()))
    await loaded()
    const cards = screen.getAllByRole('article')
    expect(cards).toHaveLength(5)
    expect(cards[0].getAttribute('aria-labelledby')).toBe(
      `resource-${resourceFixtures[0].id}`,
    )
    expect(within(cards[0]).getByText(/#1 · Ranking score:/)).toBeTruthy()
    expect(
      within(cards[0]).getByText(
        /Your latest assessment score for Budgeting was 33%/,
      ),
    ).toBeTruthy()
    for (const text of ['Budgeting', 'Beginner', 'Example Learning'])
      expect(within(cards[0]).getByText(text)).toBeTruthy()
    for (const card of cards) {
      const link = within(card).getByRole('link', {
        name: /Open Resource.*opens in a new tab/,
      })
      expect(link.getAttribute('href')).toMatch(/^https:\/\//)
      expect(link.getAttribute('target')).toBe('_blank')
      expect(link.getAttribute('rel')).toBe('noopener noreferrer')
    }
    expect(screen.getByText(/not probabilities of success/)).toBeTruthy()
    expect(mock.load).toHaveBeenCalledOnce()
  })
  it('preserves route protection for signed-out students', async () => {
    visit(auth(null), true)
    expect(
      await screen.findByRole('heading', { name: 'Welcome back.' }),
    ).toBeTruthy()
    expect(mock.load).not.toHaveBeenCalled()
  })
  it('handles missing assessment results without claiming poor knowledge', async () => {
    mock.load.mockResolvedValue({ ...fixture(), assessmentStatus: 'missing' })
    visit()
    await loaded()
    expect(
      screen.getByText(/You have no completed knowledge check yet/).textContent,
    ).toContain('no knowledge gaps are assumed')
    expect(
      screen
        .getByRole('link', { name: 'Take the knowledge check' })
        .getAttribute('href'),
    ).toBe('/assessment')
  })
  it('explains partial assessment data and still displays recommendations', async () => {
    mock.load.mockResolvedValue({ ...fixture(), assessmentStatus: 'partial' })
    visit()
    await loaded()
    expect(
      screen.getByText(/Some topics in your latest assessment/).textContent,
    ).toContain('neutral value')
    expect(screen.getAllByRole('article')).toHaveLength(5)
  })
  it('provides a preferences link for a missing profile', async () => {
    mock.load.mockResolvedValue({
      ...fixture(),
      profileMissing: true,
      experienceMissing: true,
    })
    visit()
    await loaded()
    expect(screen.getByText(/Your preferences are not saved yet/)).toBeTruthy()
    expect(
      screen
        .getByRole('link', { name: 'set your preferences' })
        .getAttribute('href'),
    ).toBe('/onboarding')
  })
  it('explains the accessible default when experience is missing', async () => {
    mock.load.mockResolvedValue({ ...fixture(), experienceMissing: true })
    visit()
    await loaded()
    expect(
      screen.getByText(/Your experience level is not set/).textContent,
    ).toContain('accessible default')
    expect(
      screen.getByRole('link', { name: 'Update your preferences' }),
    ).toBeTruthy()
  })
  it('handles an empty resource catalog', async () => {
    mock.load.mockResolvedValue({ ...fixture(), recommendations: [] })
    visit()
    expect(
      await screen.findByRole('heading', {
        name: 'No resources are available to recommend yet.',
      }),
    ).toBeTruthy()
    expect(screen.queryAllByRole('article')).toHaveLength(0)
    expect(
      screen
        .getByRole('link', { name: 'Explore the resource library' })
        .getAttribute('href'),
    ).toBe('/resources')
  })
  it('displays fewer than five recommendations when the usable catalog is smaller', async () => {
    mock.load.mockResolvedValue({
      ...fixture(),
      recommendations: fixture().recommendations.slice(0, 2),
    })
    visit()
    expect(
      await screen.findByRole('heading', { name: 'Your top 2 resources' }),
    ).toBeTruthy()
    expect(screen.getAllByRole('article')).toHaveLength(2)
  })
  it('reports missing public configuration without starting a request', async () => {
    mock.configured = false
    visit()
    expect((await screen.findByRole('alert')).textContent).toContain(
      'configuration is missing',
    )
    expect(mock.load).not.toHaveBeenCalled()
  })
  it('sanitizes unexpected errors and retries successfully', async () => {
    mock.load.mockRejectedValueOnce(new Error('private database diagnostic'))
    visit()
    expect((await screen.findByRole('alert')).textContent).not.toContain(
      'private',
    )
    fireEvent.click(
      screen.getByRole('button', { name: 'Retry recommendations' }),
    )
    await loaded()
    expect(mock.load).toHaveBeenCalledTimes(2)
  })
  it('displays safe session errors returned by the loader', async () => {
    mock.load.mockRejectedValue(
      new RecommendationError('Please sign in again.'),
    )
    visit()
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Please sign in again.',
    )
  })
  it('rejects a response whose verified identity differs from the current page account', async () => {
    mock.load.mockResolvedValue(fixture('different-student'))
    visit()
    expect((await screen.findByRole('alert')).textContent).toContain(
      'Your account changed',
    )
    expect(screen.queryAllByRole('article')).toHaveLength(0)
  })
  it('cancels pending work and hides the previous account on an account switch', async () => {
    let finish: (data: RecommendationData) => void = () => {}
    mock.load.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )
    const view = visit()
    const oldSignal = mock.load.mock.calls[0][1] as AbortSignal
    mock.load.mockResolvedValueOnce(fixture('different-student'))
    view.rerender(tree(auth('different-student')))
    await loaded()
    expect(oldSignal.aborted).toBe(true)
    await act(async () => finish({ ...fixture(), recommendations: [] }))
    expect(screen.getAllByRole('article')).toHaveLength(5)
  })
  it('hides loaded recommendations immediately on sign-out', async () => {
    const view = visit()
    await loaded()
    view.rerender(tree(auth(null)))
    expect(screen.queryAllByRole('article')).toHaveLength(0)
  })
  it('cancels pending requests when leaving the page', () => {
    mock.load.mockImplementation(() => new Promise(() => {}))
    const view = visit()
    const cancellation = mock.load.mock.calls[0][1] as AbortSignal
    view.unmount()
    expect(cancellation.aborted).toBe(true)
  })
  it('times out even if identity verification never resolves and ignores late responses', async () => {
    vi.useFakeTimers()
    let finish: (data: RecommendationData) => void = () => {}
    try {
      mock.load.mockImplementation(
        () =>
          new Promise((resolve) => {
            finish = resolve
          }),
      )
      visit()
      const cancellation = mock.load.mock.calls[0][1] as AbortSignal
      await act(async () => {
        await vi.advanceTimersByTimeAsync(15000)
      })
      expect(cancellation.aborted).toBe(true)
      expect(screen.getByRole('alert').textContent).toContain('timed out')
      await act(async () => finish(fixture()))
      expect(screen.queryAllByRole('article')).toHaveLength(0)
    } finally {
      vi.useRealTimers()
    }
  })
  it('renders explanation and resource text without interpreting HTML', async () => {
    const data = fixture()
    data.recommendations = [
      {
        ...data.recommendations[0],
        title: '<img src=x onerror=alert(1)>',
        explanation: '<script>unsafe</script>',
      },
    ]
    mock.load.mockResolvedValue(data)
    const view = visit()
    expect(
      await screen.findByRole('heading', {
        name: '<img src=x onerror=alert(1)>',
      }),
    ).toBeTruthy()
    expect(screen.getByText('<script>unsafe</script>')).toBeTruthy()
    expect(view.container.querySelector('script, img')).toBeNull()
  })
})
