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
  if (!user) return <Navigate to="/" replace />
  if (
    !permissions.some((permission) => user.permissions.includes(permission))
  ) {
    return <Navigate to="/" replace />
  }
  return <Outlet />
}
