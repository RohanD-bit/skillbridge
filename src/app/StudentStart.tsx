import { Navigate } from 'react-router-dom'
import { useAuth } from '../auth/auth-context'
import { hasCompletePreferences } from '../onboarding/preferences'

// RequireAuth resolves the session/profile before this route renders. Returning
// students resume the saved assessment view; no extra routing query is needed.
export function StudentStart() {
  const { profile } = useAuth()
  return (
    <Navigate
      to={hasCompletePreferences(profile) ? '/assessment' : '/onboarding'}
      replace
    />
  )
}
