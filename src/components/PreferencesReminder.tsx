import { Link } from 'react-router-dom'
import { useAuth } from '../auth/auth-context'
import { hasCompletePreferences } from '../onboarding/preferences'

export function PreferencesReminder() {
  const { profile } = useAuth()
  if (hasCompletePreferences(profile)) return null
  return (
    <aside
      aria-label="Learning preferences reminder"
      className="mb-6 rounded-xl border border-line bg-mint p-4 text-sm leading-7"
    >
      Your learning preferences are incomplete. You can keep exploring, or{' '}
      <Link to="/onboarding" className="font-semibold text-forest underline">
        complete your preferences
      </Link>{' '}
      to help personalize your learning path.
    </aside>
  )
}
