import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { useAuth } from './auth-context'
import { authErrorMessage } from './auth-errors'

export function AccountControls() {
  const auth = useAuth()
  const navigate = useNavigate()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function logout() {
    if (pending) return
    setPending(true)
    setError(null)
    try {
      await auth.signOut()
      navigate('/login', { replace: true })
    } catch (failure) {
      setError(authErrorMessage(failure))
    } finally {
      setPending(false)
    }
  }
  if (auth.loading)
    return (
      <p role="status" className="m-4 px-3 py-3 text-sm text-muted">
        Checking session…
      </p>
    )
  if (!auth.user)
    return (
      <NavLink
        to="/login"
        className="m-4 flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-muted hover:bg-mint"
      >
        <Icon name="user" />
        Log in / Sign up
      </NavLink>
    )
  return (
    <div className="m-4 rounded-xl border border-line p-3">
      <p className="text-xs font-semibold text-forest">Student account</p>
      <button
        type="button"
        disabled={pending}
        onClick={logout}
        className="mt-2 min-h-11 w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-ink hover:bg-mint disabled:text-muted"
      >
        {pending ? 'Logging out…' : 'Log out'}
      </button>
      {pending && (
        <p role="status" className="text-xs text-muted">
          Ending your session…
        </p>
      )}
      {error && (
        <p role="alert" className="mt-2 text-xs leading-5 text-red-900">
          {error}
        </p>
      )}
    </div>
  )
}
