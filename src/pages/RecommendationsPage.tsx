import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/auth-context'
import { PageIntro } from '../components/PageIntro'
import { supabase } from '../lib/supabase'
import { ResourceCard } from '../resources/ResourceCard'
import {
  loadRecommendations,
  RecommendationError,
} from '../recommendations/recommendations-api'
import type { RecommendationData } from '../recommendations/recommendations-api'

export function RecommendationsPage() {
  const { user } = useAuth()
  return user ? (
    <RecommendationWorkspace key={user.id} studentId={user.id} />
  ) : null
}
type RecommendationState =
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | { phase: 'ready'; data: RecommendationData }

function RecommendationWorkspace({ studentId }: { studentId: string }) {
  const [state, setState] = useState<RecommendationState>({ phase: 'loading' })
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let current = true
    const controller = new AbortController()
    const timeout = window.setTimeout(() => {
      controller.abort()
      if (current) {
        current = false
        setState({
          phase: 'error',
          message:
            'Loading recommendations timed out. Check your connection and try again.',
        })
      }
    }, 15000)
    setState({ phase: 'loading' })
    async function load() {
      try {
        if (!supabase)
          throw new RecommendationError(
            'The Supabase public configuration is missing. Contact the project administrator.',
          )
        const data = await loadRecommendations(supabase, controller.signal)
        if (!current) return
        // This ID only guards display after an account switch. It never chooses
        // whose private rows are queried; the loader verifies identity itself.
        if (data.studentId !== studentId)
          throw new RecommendationError(
            'Your account changed while loading. Please retry recommendations.',
          )
        setState({ phase: 'ready', data })
      } catch (error) {
        controller.abort()
        if (current)
          setState({
            phase: 'error',
            message:
              error instanceof RecommendationError
                ? error.message
                : 'Recommendations could not be loaded. Check your connection and try again.',
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
  }, [studentId, attempt])

  return (
    <>
      <PageIntro
        eyebrow="Step 03 · Your learning path"
        title="Learning that meets you where you are."
      >
        A starting point for your next lesson, based on your saved preferences
        and latest knowledge check. Each suggestion explains how it was ranked.
      </PageIntro>
      {state.phase === 'loading' ? (
        <p role="status" className="card">
          Finding resources for your learning path…
        </p>
      ) : state.phase === 'error' ? (
        <div className="card max-w-3xl">
          <p role="alert">{state.message}</p>
          <button
            type="button"
            className="button mt-4"
            onClick={() => setAttempt((value) => value + 1)}
          >
            Retry recommendations
          </button>
        </div>
      ) : (
        <>
          <section
            className="card mb-6"
            aria-labelledby="recommendation-method"
          >
            <h2 id="recommendation-method" className="text-lg font-semibold">
              How these suggestions work
            </h2>
            <p className="mt-3 text-sm leading-7 text-muted">
              We use clear rules: 45% knowledge-gap relevance, 35% difficulty
              compatibility, and 20% interests and learning-goal keywords.
              Ranking scores compare resources; they are not probabilities of
              success. Keyword matching is not semantic AI.
            </p>
            {state.data.profileMissing && (
              <p className="mt-3 text-sm leading-7">
                Your preferences are not saved yet. Accessible beginner defaults
                are used until you{' '}
                <Link
                  className="font-semibold text-forest underline"
                  to="/onboarding"
                >
                  set your preferences
                </Link>
                .
              </p>
            )}
            {!state.data.profileMissing && state.data.experienceMissing && (
              <p className="mt-3 text-sm leading-7">
                Your experience level is not set. Beginner compatibility is used
                as an accessible default.{' '}
                <Link
                  className="font-semibold text-forest underline"
                  to="/onboarding"
                >
                  Update your preferences
                </Link>
                .
              </p>
            )}
            {state.data.assessmentStatus === 'missing' && (
              <p className="mt-3 text-sm leading-7">
                You have no completed knowledge check yet. Suggestions use your
                preferences and difficulty compatibility; no knowledge gaps are
                assumed.{' '}
                <Link
                  className="font-semibold text-forest underline"
                  to="/assessment"
                >
                  Take the knowledge check
                </Link>{' '}
                when you’re ready.
              </p>
            )}
            {state.data.assessmentStatus === 'partial' && (
              <p className="mt-3 text-sm leading-7">
                Some topics in your latest assessment have no usable score.
                Those topics use a neutral value, without assuming a knowledge
                gap.
              </p>
            )}
          </section>
          {state.data.recommendations.length ? (
            <section aria-labelledby="recommendation-list-title">
              <h2
                id="recommendation-list-title"
                className="mb-5 text-xl font-semibold"
              >
                Your top {state.data.recommendations.length} resources
              </h2>
              <ol className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {state.data.recommendations.map((recommendation, index) => (
                  <li key={recommendation.id} className="min-w-0">
                    <ResourceCard resource={recommendation}>
                      <div className="mt-5 border-t border-line pt-4">
                        <p className="text-xs font-semibold text-forest">
                          #{index + 1} · Ranking score:{' '}
                          {(recommendation.score * 100).toFixed(1)} / 100
                        </p>
                        <p className="mt-3 text-sm leading-7 break-words text-muted">
                          {recommendation.explanation}
                        </p>
                      </div>
                    </ResourceCard>
                  </li>
                ))}
              </ol>
            </section>
          ) : (
            <section className="card" aria-labelledby="recommendations-empty">
              <h2 id="recommendations-empty" className="text-xl font-semibold">
                No resources are available to recommend yet.
              </h2>
              <p className="mt-3 text-sm leading-7 text-muted">
                Recommendations need active resources with secure HTTPS links.
                Please check back later.
              </p>
              <Link
                to="/resources"
                className="mt-4 inline-block min-h-12 py-3 text-sm font-semibold text-forest underline"
              >
                Explore the resource library
              </Link>
            </section>
          )}
        </>
      )}
    </>
  )
}
