import { Navigate, Outlet, useLocation } from 'react-router-dom'
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
        <p role="alert">{error}</p>
        <button type="button" onClick={() => void refresh()}>
          Retry
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
