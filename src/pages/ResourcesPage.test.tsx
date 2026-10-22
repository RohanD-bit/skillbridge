import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { User } from '@supabase/supabase-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext } from '../auth/auth-context'
import type { AuthContextValue } from '../auth/auth-context'
import { resourceFixtures } from '../resources/test-fixtures'
import type { LearningResource } from '../resources/catalog'
import { ResourcesPage } from './ResourcesPage'

const mock = vi.hoisted(() => ({ load: vi.fn(), configured: true }))
vi.mock('../lib/supabase', () => ({
  get supabase() {
    return mock.configured ? {} : null
  },
}))
vi.mock('../resources/catalog', async (original) => ({
  ...(await original<typeof import('../resources/catalog')>()),
  loadResources: mock.load,
}))
function auth(userId: string | null = 'fixture-student'): AuthContextValue {
  return {
    user: userId ? ({ id: userId } as User) : null,
    session: null,
    loading: false,
    configured: true,
    sessionError: null,
    profile: null,
    profileLoading: false,
    profileError: null,
    retryProfile: vi.fn(),
    retrySession: vi.fn(),
    signIn: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
  }
}
function tree(context: AuthContextValue) {
  return (
    <AuthContext.Provider value={context}>
      <MemoryRouter>
        <ResourcesPage />
      </MemoryRouter>
    </AuthContext.Provider>
  )
}
function visit(context = auth()) {
  return render(tree(context))
}
async function loaded() {
  await screen.findByText('10 of 10 resources')
}
function select(label: string, value: string) {
  fireEvent.change(screen.getByRole('combobox', { name: label }), {
    target: { value },
  })
}
function search(value: string) {
  fireEvent.change(
    screen.getByRole('searchbox', { name: 'Search resources' }),
    { target: { value } },
  )
}
beforeEach(() => {
  vi.resetAllMocks()
  mock.configured = true
  mock.load.mockResolvedValue(resourceFixtures)
})

describe('resource catalog interface', () => {
  it('loads ten resources with all required metadata', async () => {
    let resolve: (rows: LearningResource[]) => void = () => {}
    mock.load.mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done
        }),
    )
    visit()
    expect(screen.getByRole('status').textContent).toContain(
      'Loading learning resources',
    )
    await act(async () => resolve(resourceFixtures))
    await loaded()
    expect(screen.getAllByRole('article')).toHaveLength(10)
    const card = screen.getByRole('article', { name: 'Budgeting basics' })
    for (const text of [
      'Make a spending plan.',
      'Example Learning',
      'Budgeting',
      'Beginner',
      'Lesson',
    ])
      expect(within(card).getByText(text)).toBeTruthy()
    expect(
      within(card).getByRole('link', { name: /Open Resource/ }),
    ).toBeTruthy()
  })
  it('keeps the landing page public but does not query resources while signed out', () => {
    visit(auth(null))
    expect(
      screen
        .getByRole('link', { name: 'Sign in to explore resources' })
        .getAttribute('href'),
    ).toBe('/login')
    expect(mock.load).not.toHaveBeenCalled()
  })
  it('waits for session restoration before fetching resources', () => {
    visit({ ...auth(), loading: true })
    expect(screen.getByRole('status').textContent).toContain(
      'Restoring your session',
    )
    expect(mock.load).not.toHaveBeenCalled()
  })
  it('handles missing configuration without querying', async () => {
    visit({ ...auth(), configured: false })
    expect(screen.getByRole('alert').textContent).toContain(
      'configuration is missing',
    )
    expect(mock.load).not.toHaveBeenCalled()
  })
  it('handles an unavailable client even if the auth context is configured', async () => {
    mock.configured = false
    visit()
    expect((await screen.findByRole('alert')).textContent).toContain(
      'configuration is missing',
    )
    expect(mock.load).not.toHaveBeenCalled()
  })
  it('offers a session retry without querying on a session error', () => {
    const context = { ...auth(), sessionError: 'Session unavailable.' }
    visit(context)
    fireEvent.click(screen.getByRole('button', { name: 'Retry session' }))
    expect(context.retrySession).toHaveBeenCalledOnce()
    expect(mock.load).not.toHaveBeenCalled()
  })
  it('searches titles and descriptions case-insensitively', async () => {
    visit()
    await loaded()
    search('PLAN')
    expect(screen.getByText('2 of 10 resources')).toBeTruthy()
    expect(
      screen.getByRole('article', { name: 'Budgeting basics' }),
    ).toBeTruthy()
    expect(
      screen.getByRole('article', { name: 'A spending plan' }),
    ).toBeTruthy()
    expect(screen.queryByRole('article', { name: 'Credit scores' })).toBeNull()
  })
  it.each([
    ['Topic', 'budgeting', 3, 'Budgeting basics'],
    ['Difficulty', 'beginner', 5, 'Budgeting basics'],
    ['Resource type', 'video', 3, 'Credit scores'],
  ])('filters by %s', async (label, value, count, title) => {
    visit()
    await loaded()
    select(label as string, value as string)
    expect(screen.getAllByRole('article')).toHaveLength(count as number)
    expect(screen.getByRole('article', { name: title as string })).toBeTruthy()
  })
  it('combines every filter with keyword search without refetching', async () => {
    visit()
    await loaded()
    search('spending')
    select('Topic', 'budgeting')
    select('Difficulty', 'beginner')
    select('Resource type', 'lesson')
    expect(screen.getByText('1 of 10 resources')).toBeTruthy()
    expect(screen.getAllByRole('article')).toHaveLength(1)
    expect(
      screen.getByRole('article', { name: 'Budgeting basics' }),
    ).toBeTruthy()
    expect(mock.load).toHaveBeenCalledOnce()
  })
  it('clears the keyword and all three filters', async () => {
    visit()
    await loaded()
    search('spending')
    select('Topic', 'budgeting')
    select('Difficulty', 'beginner')
    select('Resource type', 'lesson')
    fireEvent.click(screen.getByRole('button', { name: 'Clear Filters' }))
    expect(screen.getByText('10 of 10 resources')).toBeTruthy()
    expect((screen.getByRole('searchbox') as HTMLInputElement).value).toBe('')
    for (const input of screen.getAllByRole('combobox'))
      expect((input as HTMLSelectElement).value).toBe('')
  })
  it('shows an empty-results message for an unmatched keyword', async () => {
    visit()
    await loaded()
    search('no matching resource')
    expect(screen.getByText('0 of 10 resources')).toBeTruthy()
    expect(
      screen.getByRole('heading', { name: 'No resources match your search.' }),
    ).toBeTruthy()
    expect(screen.queryAllByRole('article')).toHaveLength(0)
  })
  it('shows empty results for incompatible filters', async () => {
    visit()
    await loaded()
    select('Topic', 'saving')
    select('Resource type', 'workshop')
    expect(
      screen.getByRole('heading', { name: 'No resources match your search.' }),
    ).toBeTruthy()
  })
  it('distinguishes an empty library from no matching results', async () => {
    mock.load.mockResolvedValue([])
    visit()
    expect(
      await screen.findByRole('heading', {
        name: 'The library is getting ready.',
      }),
    ).toBeTruthy()
    expect(screen.getByText('0 of 0 resources')).toBeTruthy()
  })
  it('sanitizes unexpected failures and retries successfully', async () => {
    mock.load.mockRejectedValueOnce(new Error('private database detail'))
    visit()
    expect((await screen.findByRole('alert')).textContent).not.toContain(
      'private',
    )
    fireEvent.click(
      screen.getByRole('button', { name: 'Retry loading resources' }),
    )
    await loaded()
    expect(mock.load).toHaveBeenCalledTimes(2)
  })
  it('only renders HTTPS links with safe new-tab attributes and accessible names', async () => {
    visit()
    await loaded()
    for (const link of screen.getAllByRole('link', {
      name: /Open Resource.*opens in a new tab/,
    })) {
      expect(link.getAttribute('href')).toMatch(/^https:\/\//)
      expect(link.getAttribute('target')).toBe('_blank')
      expect(link.getAttribute('rel')).toBe('noopener noreferrer')
    }
  })
  it.each([
    'http://unsafe.example.test',
    'javascript:alert(1)',
    'https://user:password@example.test',
  ])('does not render unsafe href %s', async (url) => {
    mock.load.mockResolvedValue([{ ...resourceFixtures[0], url }])
    visit()
    await screen.findByText('A secure resource link is not available.')
    expect(screen.queryByRole('link')).toBeNull()
    expect(
      screen.getByRole('article', { name: 'Budgeting basics' }),
    ).toBeTruthy()
  })
  it('renders untrusted titles and descriptions as plain text', async () => {
    mock.load.mockResolvedValue([
      {
        ...resourceFixtures[0],
        title: '<img src=x onerror=alert(1)>',
        description: '<script>unsafe</script>',
      },
    ])
    const view = visit()
    expect(
      await screen.findByRole('heading', {
        name: '<img src=x onerror=alert(1)>',
      }),
    ).toBeTruthy()
    expect(screen.getByText('<script>unsafe</script>')).toBeTruthy()
    expect(view.container.querySelector('script, img')).toBeNull()
  })
  it('aborts a pending request when leaving the page', async () => {
    mock.load.mockImplementation(() => new Promise(() => {}))
    const view = visit()
    const cancellation = mock.load.mock.calls[0][1] as AbortSignal
    view.unmount()
    expect(cancellation.aborted).toBe(true)
  })
  it('discards a previous account response and clears filters when accounts change', async () => {
    let finish: (rows: LearningResource[]) => void = () => {}
    mock.load.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )
    const view = visit()
    const oldSignal = mock.load.mock.calls[0][1] as AbortSignal
    mock.load.mockResolvedValueOnce([resourceFixtures[1]])
    view.rerender(tree(auth('different-student')))
    await screen.findByRole('article', { name: 'Build a buffer' })
    expect(oldSignal.aborted).toBe(true)
    await act(async () => finish([resourceFixtures[0]]))
    expect(
      screen.queryByRole('article', { name: 'Budgeting basics' }),
    ).toBeNull()
    expect(screen.getByText('1 of 1 resources')).toBeTruthy()
  })
  it('removes loaded resources immediately on sign-out', async () => {
    const view = visit()
    await loaded()
    view.rerender(tree(auth(null)))
    expect(screen.queryAllByRole('article')).toHaveLength(0)
    expect(
      screen.getByRole('link', { name: 'Sign in to explore resources' }),
    ).toBeTruthy()
  })
  it('clears a previous account search when switching signed-in accounts', async () => {
    const view = visit()
    await loaded()
    search('nonexistent')
    view.rerender(tree(auth('different-student')))
    await loaded()
    expect((screen.getByRole('searchbox') as HTMLInputElement).value).toBe('')
  })
  it('reports a timeout instead of leaving loading indefinitely', async () => {
    vi.useFakeTimers()
    try {
      mock.load.mockImplementation(
        (_client, cancellation: AbortSignal) =>
          new Promise((_resolve, reject) => {
            cancellation.addEventListener(
              'abort',
              () => reject(new Error('Request timed out')),
              { once: true },
            )
          }),
      )
      visit()
      await act(async () => {
        await vi.advanceTimersByTimeAsync(15000)
      })
      expect(screen.getByRole('alert').textContent).toContain(
        'could not be loaded',
      )
    } finally {
      vi.useRealTimers()
    }
  })
  it('marks result counts as live updates without moving focus from search', async () => {
    visit()
    await loaded()
    const input = screen.getByRole('searchbox')
    input.focus()
    search('PLAN')
    expect(document.activeElement).toBe(input)
    await waitFor(() =>
      expect(screen.getByRole('status').textContent).toBe('2 of 10 resources'),
    )
    expect(screen.getByRole('status').getAttribute('aria-live')).toBe('polite')
  })
})
