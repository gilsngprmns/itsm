import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from './AuthContext'

export function RequirePermission({ permission }: { permission: string }) {
  const { user } = useAuth()

  if (!user?.permissions.includes(permission)) {
    return (
      <main className="page">
        <h1>Access denied</h1>
        <p role="alert">You do not have permission to view this page.</p>
      </main>
    )
  }
  return <Outlet />
}

export function RequireAnyPermission({
  permissions,
}: {
  permissions: string[]
}) {
  const { user } = useAuth()
  if (
    !user ||
    !permissions.some((permission) => user.permissions.includes(permission))
  ) {
    return <Navigate to="/" replace />
  }
  return <Outlet />
}
