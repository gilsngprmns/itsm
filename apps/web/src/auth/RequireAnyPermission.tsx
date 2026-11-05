import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from './AuthContext'

export function RequireAnyPermission({
  permissions,
}: {
  permissions: string[]
}) {
  const { status, user } = useAuth()
  const location = useLocation()

  if (status === 'loading') {
    return <main className="page">Checking your session…</main>
  }
  if (status !== 'authenticated') {
    return <Navigate to="/login" replace state={{ from: location }} />
  }
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />
  if (
    !permissions.some((permission) => user.permissions.includes(permission))
  ) {
    return (
      <main className="page">
        <h1>Access denied</h1>
        <p role="alert">You do not have permission to view this page.</p>
      </main>
    )
  }
  return <Outlet />
}
