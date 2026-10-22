import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/auth-context'
import { PageIntro } from '../components/PageIntro'
import { Icon } from '../components/Icon'
import { supabase } from '../lib/supabase'
import { ResourceCard } from '../resources/ResourceCard'
import {
  emptyFilters,
  filterResources,
  loadResources,
  ResourceCatalogError,
  resourceDifficulties,
  resourceTopics,
  resourceTypes,
} from '../resources/catalog'
import type { LearningResource, ResourceFilters } from '../resources/catalog'

export function ResourcesPage() {
  const auth = useAuth()
  return (
    <>
      <PageIntro
        eyebrow="The resource library"
        title="Curiosity looks good on you."
      >
        Explore lessons, workshops, videos, and articles about money. Find a
        topic you care about and learn at your own pace.
      </PageIntro>
      {auth.loading ? (
        <p role="status" className="card">
          Restoring your session…
        </p>
      ) : !auth.configured ? (
        <p role="alert" className="card">
          The Supabase public configuration is missing. Contact the project
          administrator to connect the resource library.
        </p>
      ) : auth.sessionError ? (
        <div className="card">
          <p role="alert">{auth.sessionError}</p>
          <button
            type="button"
            className="button mt-4"
            onClick={auth.retrySession}
          >
            Retry session
          </button>
        </div>
      ) : auth.user ? (
        <ResourceCatalog key={auth.user.id} />
      ) : (
        <section className="card max-w-2xl" aria-labelledby="library-sign-in">
          <h2 id="library-sign-in" className="text-xl font-semibold">
            Your next discovery starts here.
          </h2>
          <p className="mt-3 text-sm leading-7 text-muted">
            Sign in to browse the resource library and filter by your interests.
          </p>
          <Link
            to="/login"
            state={{ from: '/resources' }}
            className="button mt-5 inline-block"
          >
            Sign in to explore resources
          </Link>
        </section>
      )}
    </>
  )
}

type CatalogState =
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | { phase: 'ready'; resources: LearningResource[] }

function ResourceCatalog() {
  const [state, setState] = useState<CatalogState>({ phase: 'loading' })
  const [attempt, setAttempt] = useState(0)
  const [filters, setFilters] = useState<ResourceFilters>({ ...emptyFilters })
  useEffect(() => {
    const controller = new AbortController()
    let current = true
    const timeout = window.setTimeout(() => controller.abort(), 15000)
    setState({ phase: 'loading' })
    async function load() {
      try {
        if (!supabase)
          throw new ResourceCatalogError(
            'The Supabase public configuration is missing. Contact the project administrator.',
          )
        const resources = await loadResources(supabase, controller.signal)
        if (current) setState({ phase: 'ready', resources })
      } catch (error) {
        if (current)
          setState({
            phase: 'error',
            message:
              error instanceof ResourceCatalogError
                ? error.message
                : 'The resource library could not be loaded. Check your connection and try again.',
          })
      } finally {
        window.clearTimeout(timeout)
      }
    }
    void load()
    return () => {
      current = false
      controller.abort()
      window.clearTimeout(timeout)
    }
  }, [attempt])

  if (state.phase === 'loading')
    return (
      <p role="status" className="card">
        Loading learning resources…
      </p>
    )
  if (state.phase === 'error')
    return (
      <div className="card">
        <p role="alert">{state.message}</p>
        <button
          type="button"
          className="button mt-4"
          onClick={() => setAttempt((value) => value + 1)}
        >
          Retry loading resources
        </button>
      </div>
    )
  const matching = filterResources(state.resources, filters)
  const hasFilters = Object.values(filters).some((value) => value !== '')
  function setFilter(field: keyof ResourceFilters, value: string) {
    setFilters((previous) => ({ ...previous, [field]: value }))
  }
  return (
    <>
      <section aria-label="Search and filter resources" className="card">
        <label htmlFor="resource-search" className="field-label">
          Search resources
        </label>
        <div className="relative">
          <Icon
            name="search"
            className="pointer-events-none absolute top-4 left-4 text-muted"
          />
          <input
            id="resource-search"
            type="search"
            value={filters.keyword}
            onChange={(event) => setFilter('keyword', event.target.value)}
            placeholder="Try saving, credit scores, or a spending plan"
            className="field pl-12"
            aria-describedby="resource-search-help"
            aria-controls="resource-results"
          />
        </div>
        <p
          id="resource-search-help"
          className="mt-2 text-xs leading-5 text-muted"
        >
          Search titles and descriptions. Results update as you type.
        </p>
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          {(
            [
              ['topic', 'Topic', 'All topics', resourceTopics],
              ['difficulty', 'Difficulty', 'All levels', resourceDifficulties],
              ['resourceType', 'Resource type', 'All types', resourceTypes],
            ] as const
          ).map(([field, label, all, options]) => (
            <label
              key={field}
              htmlFor={`resource-${field}`}
              className="field-label"
            >
              {label}
              <select
                id={`resource-${field}`}
                className="field"
                value={filters[field]}
                onChange={(event) => setFilter(field, event.target.value)}
                aria-controls="resource-results"
              >
                <option value="">{all}</option>
                {Object.entries(options).map(([value, text]) => (
                  <option key={value} value={value}>
                    {text}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <p
            role="status"
            aria-live="polite"
            aria-atomic="true"
            className="text-sm text-muted"
          >
            {matching.length} of {state.resources.length} resources
          </p>
          <button
            type="button"
            className="min-h-12 rounded-lg px-3 text-sm font-semibold text-forest underline underline-offset-4 disabled:text-muted disabled:no-underline"
            disabled={!hasFilters}
            onClick={() => setFilters({ ...emptyFilters })}
          >
            Clear Filters
          </button>
        </div>
      </section>
      <section
        id="resource-results"
        aria-labelledby="resource-results-title"
        className="mt-8"
      >
        <h2 id="resource-results-title" className="mb-5 text-xl font-semibold">
          {hasFilters ? 'Your search results' : 'Explore the library'}
        </h2>
        {matching.length ? (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {matching.map((resource) => (
              <ResourceCard key={resource.id} resource={resource} />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-line px-6 py-12 text-center">
            <Icon name="search" className="mx-auto h-8 w-8 text-forest" />
            <h3 className="mt-4 text-lg font-semibold">
              {state.resources.length
                ? 'No resources match your search.'
                : 'The library is getting ready.'}
            </h3>
            <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-muted">
              {state.resources.length
                ? 'Try another keyword, choose broader filters, or use Clear Filters to see the whole library.'
                : 'There are no active resources to explore right now. Please check back later.'}
            </p>
          </div>
        )}
      </section>
    </>
  )
}
