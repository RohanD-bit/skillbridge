import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL?.trim()
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()

function isPublicConfiguration() {
  if (
    !url ||
    !key ||
    url.includes('your-project-ref') ||
    key.includes('your_public_key_here')
  )
    return false
  try {
    return (
      new URL(url).protocol === 'https:' && key.startsWith('sb_publishable_')
    )
  } catch {
    return false
  }
}

export const isSupabaseConfigured = isPublicConfiguration()

// Capture failed confirmation redirects before the SDK cleans the URL. Never
// display error_description or other URL contents, which are untrusted input.
const callbackParameters = [
  new URLSearchParams(window.location.search),
  new URLSearchParams(window.location.hash.slice(1)),
]
export const authRedirectError = callbackParameters.some(
  (parameters) => parameters.has('error') || parameters.has('error_code'),
)
  ? 'That confirmation link is invalid or has expired. Try logging in if you already confirmed your email, or register again to request a new link.'
  : null

// Never put privileged keys in VITE_* variables. The SDK manages session storage,
// refresh, and email-confirmation redirects; application code never logs tokens.
export const supabase = isSupabaseConfigured
  ? createClient(url!, key!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null
