import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { ApiRequestError, apiRequest } from '../lib/api'

export interface AuthenticatedUser {
  id: string
  fullName: string
  email: string
  roles: string[]
  permissions: string[]
}

type AuthStatus = 'loading' | 'authenticated' | 'anonymous' | 'unavailable'

interface AuthContextValue {
  status: AuthStatus
  user: AuthenticatedUser | null
  error: string | null
  refresh: () => Promise<void>
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [user, setUser] = useState<AuthenticatedUser | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const result = await apiRequest<{ user: AuthenticatedUser }>('auth/me')
      setUser(result.user)
      setStatus('authenticated')
      setError(null)
    } catch (cause) {
      setUser(null)
      if (cause instanceof ApiRequestError && cause.status === 401) {
        setStatus('anonymous')
        setError(null)
        return
      }
      setStatus('unavailable')
      setError(
        cause instanceof Error
          ? cause.message
          : 'Unable to check the current session.',
      )
    }
  }, [])

  const signIn = useCallback(async (email: string, password: string) => {
    setError(null)
    const result = await apiRequest<{ user: AuthenticatedUser }>('auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    setUser(result.user)
    setStatus('authenticated')
  }, [])

  const signOut = useCallback(async () => {
    await apiRequest<void>('auth/logout', { method: 'POST' })
    setUser(null)
    setStatus('anonymous')
    setError(null)
  }, [])

  useEffect(() => {
    const handleUnauthorized = () => {
      setUser(null)
      setStatus('anonymous')
      setError(null)
    }
    window.addEventListener('api:unauthorized', handleUnauthorized)
    return () =>
      window.removeEventListener('api:unauthorized', handleUnauthorized)
  }, [])

  useEffect(() => {
    queueMicrotask(() => void refresh())
  }, [refresh])

  const value = useMemo(
    () => ({ status, user, error, refresh, signIn, signOut }),
    [status, user, error, refresh, signIn, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}
