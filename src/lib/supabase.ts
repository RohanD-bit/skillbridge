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

// No requests are made by the placeholder pages. Never put privileged keys in VITE_* variables.
// A null client lets the frontend preview run before public configuration is supplied.
export const supabase = isSupabaseConfigured ? createClient(url!, key!) : null
