import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../auth/auth-context'
import { PageIntro } from '../components/PageIntro'
import { supabase } from '../lib/supabase'
import {
  AssessmentError,
  getAssessmentQuestions,
  getLatestAssessment,
  submitAssessment,
} from '../assessment/assessment-api'
import { AssessmentQuiz } from '../assessment/AssessmentQuiz'
import { AssessmentResults } from '../assessment/AssessmentResults'
import type {
  AssessmentQuestion,
  AssessmentResult,
  SubmittedAnswer,
} from '../assessment/types'

export function AssessmentPage() {
  const { user } = useAuth()
  return user ? <AssessmentWorkspace key={user.id} studentId={user.id} /> : null
}

const message = (error: unknown) =>
  error instanceof AssessmentError
    ? error.message
    : 'The assessment request could not be completed. Check your connection and try again.'

function AssessmentWorkspace({ studentId }: { studentId: string }) {
  const location = useLocation()
  const [phase, setPhase] = useState<
    'latest' | 'intro' | 'questions' | 'quiz' | 'results'
  >('latest')
  const [result, setResult] = useState<AssessmentResult | null>(null)
  const [questions, setQuestions] = useState<AssessmentQuestion[]>([])
  const [error, setError] = useState<string | null>(null)
  const [latestError, setLatestError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [checking, setChecking] = useState(false)
  const readRequest = useRef<AbortController | null>(null)
  const writeRequest = useRef<AbortController | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    readRequest.current = controller
    const timeout = window.setTimeout(() => controller.abort(), 15000)
    setPhase('latest')
    setLatestError(null)
    async function restore() {
      try {
        if (!supabase)
          throw new AssessmentError(
            'The Supabase public configuration is missing. Contact the project administrator.',
          )
        const saved = await getLatestAssessment(
          supabase,
          studentId,
          controller.signal,
        )
        if (readRequest.current !== controller) return
        setResult(saved)
        setPhase(saved ? 'results' : 'intro')
      } catch (failure) {
        if (readRequest.current === controller) setLatestError(message(failure))
      } finally {
        window.clearTimeout(timeout)
        if (readRequest.current === controller) readRequest.current = null
      }
    }
    void restore()
    return () => {
      controller.abort()
      readRequest.current?.abort()
      writeRequest.current?.abort()
      readRequest.current = null
      writeRequest.current = null
      window.clearTimeout(timeout)
    }
  }, [studentId, attempt])

  async function start() {
    if (readRequest.current || writeRequest.current) return
    const controller = new AbortController()
    readRequest.current = controller
    const timeout = window.setTimeout(() => controller.abort(), 15000)
    setError(null)
    setPhase('questions')
    try {
      if (!supabase)
        throw new AssessmentError(
          'The Supabase public configuration is missing.',
        )
      const loaded = await getAssessmentQuestions(supabase, controller.signal)
      if (readRequest.current !== controller) return
      setQuestions(loaded)
      setPhase('quiz')
    } catch (failure) {
      if (readRequest.current === controller) setError(message(failure))
    } finally {
      window.clearTimeout(timeout)
      if (readRequest.current === controller) readRequest.current = null
    }
  }

  async function submit(answers: SubmittedAnswer[]) {
    if (writeRequest.current || readRequest.current) return
    const controller = new AbortController()
    writeRequest.current = controller
    const timeout = window.setTimeout(() => controller.abort(), 30000)
    setSubmitting(true)
    setError(null)
    try {
      if (!supabase)
        throw new AssessmentError(
          'The Supabase public configuration is missing.',
        )
      const saved = await submitAssessment(supabase, answers, controller.signal)
      if (writeRequest.current !== controller) return
      setResult(saved)
      setPhase('results')
    } catch (failure) {
      if (writeRequest.current === controller) setError(message(failure))
    } finally {
      window.clearTimeout(timeout)
      if (writeRequest.current === controller) {
        writeRequest.current = null
        setSubmitting(false)
      }
    }
  }

  async function checkResults() {
    if (readRequest.current || writeRequest.current) return
    const controller = new AbortController()
    readRequest.current = controller
    const timeout = window.setTimeout(() => controller.abort(), 15000)
    setChecking(true)
    try {
      if (!supabase)
        throw new AssessmentError(
          'The Supabase public configuration is missing.',
        )
      const saved = await getLatestAssessment(
        supabase,
        studentId,
        controller.signal,
      )
      if (readRequest.current !== controller) return
      if (saved && saved.attempt_id !== result?.attempt_id) {
        setResult(saved)
        setPhase('results')
      } else
        setError(
          'No new saved result was found. You can retry your submission.',
        )
    } catch (failure) {
      if (readRequest.current === controller) setError(message(failure))
    } finally {
      window.clearTimeout(timeout)
      if (readRequest.current === controller) {
        readRequest.current = null
        setChecking(false)
      }
    }
  }

  return (
    <>
      {location.state?.onboardingSaved === true && (
        <p
          role="status"
          className="mb-6 rounded-xl border border-line bg-mint p-4 text-sm text-forest"
        >
          Your learning preferences are saved. You’re ready for your knowledge
          check.
        </p>
      )}
      <PageIntro
        eyebrow="Step 02 · Knowledge check"
        title="Find your starting point."
      >
        Explore what you already know and discover where you can grow. You don’t
        need to prepare or know every answer.
      </PageIntro>
      {phase === 'latest' &&
        (latestError ? (
          <div className="card max-w-3xl">
            <p role="alert" className="text-sm leading-6">
              {latestError}
            </p>
            <button
              type="button"
              className="button mt-4"
              onClick={() => setAttempt((value) => value + 1)}
            >
              Retry loading results
            </button>
          </div>
        ) : (
          <p role="status" className="card">
            Loading your saved assessment results…
          </p>
        ))}
      {phase === 'intro' && (
        <section className="card max-w-3xl">
          <h2 className="text-2xl font-semibold">
            A little check-in with your money knowledge
          </h2>
          <p className="mt-4 text-sm leading-7 text-muted">
            Answer 10 questions about budgeting, saving, credit, and investing.
            You can revisit any question before submitting. Your score is
            calculated securely and saved to your student account.
          </p>
          <p className="mt-3 text-sm leading-6 text-muted">
            Answers stay in this page while you navigate between questions.
            Refreshing before submission starts a new quiz; completed results
            are saved.
          </p>
          <button
            type="button"
            className="button mt-6"
            onClick={() => void start()}
          >
            Start knowledge check
          </button>
        </section>
      )}
      {phase === 'questions' &&
        (error ? (
          <div className="card max-w-3xl">
            <p role="alert" className="text-sm leading-6">
              {error}
            </p>
            <button
              type="button"
              className="button mt-4"
              onClick={() => void start()}
            >
              Retry loading questions
            </button>
          </div>
        ) : (
          <p role="status" className="card">
            Loading your 10 questions…
          </p>
        ))}
      {phase === 'quiz' && (
        <AssessmentQuiz
          questions={questions}
          submitting={submitting}
          error={error}
          onSubmit={(answers) => void submit(answers)}
          checking={checking}
          onCheckResults={() => void checkResults()}
        />
      )}
      {phase === 'results' && result && (
        <AssessmentResults result={result} onRetake={() => void start()} />
      )}
    </>
  )
}
