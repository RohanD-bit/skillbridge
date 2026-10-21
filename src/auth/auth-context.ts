import { createContext, useContext } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import type { StudentProfile } from './student-profile'

export interface AuthContextValue {
  session: Session | null
  user: User | null
  loading: boolean
  sessionError: string | null
  configured: boolean
  profile: StudentProfile | null
  profileLoading: boolean
  profileError: string | null
  retrySession: () => void
  retryProfile: () => void
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string) => Promise<boolean>
  signOut: () => Promise<void>
}
export const AuthContext = createContext<AuthContextValue | null>(null)
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}
