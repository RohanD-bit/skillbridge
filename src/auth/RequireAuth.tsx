import { Link, Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from './auth-context'
export function RequireAuth() {
  const auth = useAuth()
  const location = useLocation()
  if (auth.loading)
    return (
      <p role="status" className="card" aria-live="polite">
        Restoring your session…
      </p>
    )
  if (auth.sessionError)
    return (
      <div className="card max-w-2xl">
        <p role="alert">{auth.sessionError}</p>
        <button
          type="button"
          className="button mt-4"
          onClick={auth.retrySession}
        >
          Try again
        </button>
      </div>
    )
  if (!auth.user)
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (auth.profileLoading)
    return (
      <p role="status" className="card" aria-live="polite">
        Preparing your learning space…
      </p>
    )
  if (auth.profileError)
    return (
      <div className="card max-w-2xl">
        <p role="alert">{auth.profileError}</p>
        <button
          type="button"
          onClick={auth.retryProfile}
          className="button mt-4"
        >
          Retry profile
        </button>
        <Link
          to="/resources"
          className="mt-4 block text-sm font-semibold text-forest underline"
        >
          Explore resources while you wait
        </Link>
      </div>
    )
  if (!auth.profile && location.pathname !== '/onboarding')
    return <Navigate to="/onboarding" replace />
  return <Outlet />
}
