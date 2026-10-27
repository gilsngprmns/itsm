import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { ErrorBanner } from '../common/Feedback'
import { useAuth } from './AuthContext'

export function RequireAuth() {
  const { status, error, refresh } = useAuth()
  const location = useLocation()

  if (status === 'loading') {
    return (
      <main className="page">
        <p role="status">Checking your session…</p>
      </main>
    )
  }
  if (status === 'unavailable') {
    return (
      <main className="page">
        <h1>Could not check your session</h1>
        <ErrorBanner>
          {error
            ? 'Unable to check your session. Check your connection and try again.'
            : 'Unable to check your session. Try again.'}
        </ErrorBanner>
        <button type="button" onClick={() => void refresh()}>
          Try again
        </button>
      </main>
    )
  }
  if (status === 'anonymous') {
    return (
      <Navigate
        to="/login"
        replace
        state={{
          from: `${location.pathname}${location.search}${location.hash}`,
        }}
      />
    )
  }
  return <Outlet />
}
