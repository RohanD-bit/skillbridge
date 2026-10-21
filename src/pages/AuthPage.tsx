import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { PageIntro } from '../components/PageIntro'
import { useAuth } from '../auth/auth-context'
import { authErrorMessage, configurationMessage } from '../auth/auth-errors'
import { authRedirectError } from '../lib/supabase'

const destinations = new Set(['/onboarding', '/assessment', '/recommendations'])

export function AuthPage({ register = false }: { register?: boolean }) {
  const auth = useAuth()
  const location = useLocation()
  const requested = location.state?.from
  const destination =
    typeof requested === 'string' && destinations.has(requested)
      ? requested
      : '/onboarding'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmation, setConfirmation] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending || !auth.configured) return
    setPending(true)
    setError(null)
    setConfirmation(false)
    try {
      if (register) setConfirmation(await auth.signUp(email.trim(), password))
      else await auth.signIn(email.trim(), password)
    } catch (failure) {
      setError(authErrorMessage(failure))
    } finally {
      setPassword('')
      setPending(false)
    }
  }

  if (auth.loading)
    return (
      <p role="status" className="card">
        Restoring your session…
      </p>
    )
  if (auth.user) return <Navigate to={destination} replace />

  return (
    <>
      <PageIntro
        eyebrow="Your learning space"
        title={register ? 'Start your next chapter.' : 'Welcome back.'}
      >
        A place to build practical money skills, one step at a time.
      </PageIntro>
      <div className="card max-w-xl">
        {!auth.configured && (
          <p role="alert" className="mb-6 text-sm leading-6">
            {configurationMessage}
          </p>
        )}
        {authRedirectError && (
          <p role="alert" className="mb-6 text-sm leading-6">
            {authRedirectError}
          </p>
        )}
        {auth.sessionError && (
          <div className="mb-6">
            <p role="alert" className="text-sm">
              {auth.sessionError}
            </p>
            <button
              type="button"
              className="mt-2 text-sm font-semibold underline"
              onClick={auth.retrySession}
            >
              Retry session
            </button>
          </div>
        )}
        <div aria-live="polite" aria-atomic="true">
          {confirmation && (
            <p
              role="status"
              className="mb-6 rounded-xl bg-mint p-4 text-sm leading-6"
            >
              Check your inbox for a confirmation link, then log in. If you
              already have an account, you can use the login page. If the link
              has expired, register again to request a new confirmation email.
            </p>
          )}
        </div>
        {error && (
          <p
            id="auth-error"
            role="alert"
            className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900"
          >
            {error}
          </p>
        )}
        <form
          onSubmit={submit}
          aria-busy={pending}
          aria-describedby={error ? 'auth-error' : undefined}
        >
          <fieldset
            disabled={pending || !auth.configured}
            className="space-y-5"
          >
            <legend className="sr-only">
              {register
                ? 'Create your student account'
                : 'Log in to your student account'}
            </legend>
            <label className="field-label" htmlFor="email">
              Email address
              <input
                id="email"
                name="email"
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                placeholder="Your email address"
                className="field"
              />
            </label>
            <label className="field-label" htmlFor="password">
              Password
              <input
                id="password"
                name="password"
                type="password"
                required
                minLength={register ? 8 : undefined}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                aria-describedby={register ? 'password-help' : undefined}
                autoComplete={register ? 'new-password' : 'current-password'}
                placeholder="Your password"
                className="field"
              />
            </label>
            {register && (
              <p id="password-help" className="text-xs leading-5 text-muted">
                Use at least 8 characters. Additional password requirements may
                apply.
              </p>
            )}
            <button className="button w-full" type="submit">
              {pending
                ? register
                  ? 'Creating account…'
                  : 'Logging in…'
                : register
                  ? 'Create account'
                  : 'Log in'}
            </button>
          </fieldset>
          {pending && (
            <p role="status" className="mt-3 text-sm text-muted">
              Please wait while we securely process your request.
            </p>
          )}
        </form>
        <p className="mt-6 text-center text-sm text-muted">
          {register ? 'Already have an account?' : 'New to SkillBridge?'}{' '}
          <Link
            className="font-semibold text-forest underline underline-offset-4"
            to={register ? '/login' : '/register'}
            state={{ from: destination }}
          >
            {register ? 'Log in' : 'Create an account'}
          </Link>
        </p>
      </div>
    </>
  )
}
