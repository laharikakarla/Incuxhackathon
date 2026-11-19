import { createContext, useContext } from 'react'
import type { AuthUser } from './AuthProvider'

export type AuthContextValue = {
  user: AuthUser | null
  loading: boolean
  error: string | null
  refresh: () => Promise<AuthUser | null>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider.')
  return context
}
