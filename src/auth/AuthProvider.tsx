import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { api } from '../lib/api'
import { AuthContext } from './AuthContext'

export type UserRole = 'student' | 'super_admin' | 'registration_admin' | 'content_admin'
export type AuthUser = { id: string; email: string; role: UserRole; emailVerified: boolean; fullName: string }
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const result = await api<{ user: AuthUser }>('/api/auth/me')
      setUser(result.user)
      setError(null)
      return result.user
    } catch (reason) {
      setUser(null)
      if (reason instanceof TypeError) setError('The local backend is unavailable. Start the app with npm run dev.')
      else setError(null)
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void refresh() }, [refresh])

  const signOut = useCallback(async () => {
    await api('/api/auth/logout', { method: 'POST' })
    setUser(null)
  }, [])

  const value = useMemo(() => ({ user, loading, error, refresh, signOut }), [user, loading, error, refresh, signOut])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
