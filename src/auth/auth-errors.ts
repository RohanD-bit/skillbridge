export const configurationMessage =
  'Sign-in is unavailable. Add the Supabase project URL and publishable key to .env.local, then restart the app.'

// Do not render server internals, tokens, or request details.
export function authErrorMessage(error: unknown): string {
  const details = error && typeof error === 'object' ? error : {}
  const code = 'code' in details ? details.code : undefined
  const status = 'status' in details ? details.status : undefined
  const name = 'name' in details ? details.name : undefined
  if (code === 'invalid_credentials')
    return 'The email or password is incorrect. Please try again.'
  if (code === 'email_not_confirmed')
    return 'Please confirm your email using the link in your inbox, then log in.'
  if (code === 'user_already_exists' || code === 'email_exists')
    return 'Unable to register with this email. Try logging in or checking your inbox for a confirmation link.'
  if (code === 'weak_password')
    return 'Choose a stronger password that meets the project’s password requirements.'
  if (code === 'email_address_invalid' || code === 'validation_failed')
    return 'Check your email address and password, then try again.'
  if (
    status === 429 ||
    code === 'over_email_send_rate_limit' ||
    code === 'over_request_rate_limit'
  )
    return 'Too many attempts. Please wait a few minutes before trying again.'
  if (
    name === 'AuthRetryableFetchError' ||
    name === 'TypeError' ||
    name === 'AbortError' ||
    name === 'TimeoutError' ||
    (typeof status === 'number' && status >= 500)
  )
    return 'We couldn’t reach the sign-in service. Check your connection and try again.'
  return 'We couldn’t complete that request. Please try again. If it continues, contact the project administrator.'
}
