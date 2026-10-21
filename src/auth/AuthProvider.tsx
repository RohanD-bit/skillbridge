import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { AuthContext } from './auth-context'
import { ensureStudentProfile } from './student-profile'
import type { StudentProfile } from './student-profile'

interface SessionState {
  session: Session | null
  loading: boolean
  error: string | null
}
interface ProfileState {
  userId: string | null
  data: StudentProfile | null
  loading: boolean
  error: string | null
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<SessionState>({
    session: null,
    loading: Boolean(supabase),
    error: null,
  })
  const [sessionAttempt, setSessionAttempt] = useState(0)
  const [profileAttempt, setProfileAttempt] = useState(0)
  const [profile, setProfile] = useState<ProfileState>({
    userId: null,
    data: null,
    loading: false,
    error: null,
  })
  const userId = auth.session?.user.id ?? null
  useEffect(() => {
    if (!supabase) return
    let active = true
    let eventReceived = false
    let timedOut = false
    const timeout = window.setTimeout(() => {
      timedOut = true
      if (active)
        setAuth({
          session: null,
          loading: false,
          error:
            'Session restoration timed out. Check your connection and try again.',
        })
    }, 20000)
    setAuth({ session: null, loading: true, error: null })
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      // Synchronous: database work runs in the separate effect below.
      if (_event !== 'INITIAL_SESSION') eventReceived = true
      window.clearTimeout(timeout)
      if (active) setAuth({ session, loading: false, error: null })
    })
    void supabase.auth
      .getSession()
      .then(({ data, error }) => {
        window.clearTimeout(timeout)
        if (!active || eventReceived || timedOut) return
        setAuth({
          session: error ? null : data.session,
          loading: false,
          error: error
            ? 'We couldn’t restore your session. Check your connection and try again.'
            : null,
        })
      })
      .catch(() => {
        window.clearTimeout(timeout)
        if (active && !eventReceived && !timedOut)
          setAuth({
            session: null,
            loading: false,
            error:
              'We couldn’t restore your session. Check your connection and try again.',
          })
      })
    return () => {
      active = false
      window.clearTimeout(timeout)
      subscription.unsubscribe()
    }
  }, [sessionAttempt])
  useEffect(() => {
    if (!supabase || !userId) {
      setProfile({ userId: null, data: null, loading: false, error: null })
      return
    }
    let active = true
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 15000)
    setProfile({ userId, data: null, loading: true, error: null })
    void ensureStudentProfile(supabase, userId, controller.signal)
      .then((data) => {
        if (active) setProfile({ userId, data, loading: false, error: null })
      })
      .catch(() => {
        if (active)
          setProfile({
            userId,
            data: null,
            loading: false,
            error:
              'We couldn’t load your student profile. Check your connection and try again. If this continues, contact the project administrator.',
          })
      })
      .finally(() => window.clearTimeout(timeout))
    return () => {
      active = false
      controller.abort()
      window.clearTimeout(timeout)
    }
  }, [userId, profileAttempt])
  const value = {
    session: auth.session,
    user: auth.session?.user ?? null,
    loading: auth.loading,
    sessionError: auth.error,
    configured: Boolean(supabase),
    // Never expose a previous student's profile during an account change.
    profile: userId && profile.userId === userId ? profile.data : null,
    profileLoading: Boolean(
      userId && (profile.userId !== userId || profile.loading),
    ),
    profileError: userId && profile.userId === userId ? profile.error : null,
    retrySession: () => setSessionAttempt((attempt) => attempt + 1),
    retryProfile: () => setProfileAttempt((attempt) => attempt + 1),
    signIn: async (email: string, password: string) => {
      if (!supabase) throw new Error('Missing configuration')
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (error) throw error
    },
    signUp: async (email: string, password: string) => {
      if (!supabase) throw new Error('Missing configuration')
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/onboarding` },
      })
      if (error) throw error
      return !data.session
    },
    signOut: async () => {
      if (!supabase) return
      const { error } = await supabase.auth.signOut({ scope: 'local' })
      if (error) throw error
      setAuth({ session: null, loading: false, error: null })
    },
  }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
