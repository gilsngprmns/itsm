import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import { BrowserRouter, Link, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './auth/AuthContext'
import { RequirePermission } from './auth/RequirePermission'
import { RequireAnyPermission } from './auth/RequireAnyPermission'
import { RequireAuth } from './auth/RequireAuth'
import { apiRequest } from './lib/api'
import { AuthenticatedLayout } from './app/AuthenticatedLayout'
import './App.css'

const LoginPage = lazy(() =>
  import('./auth/LoginPage').then((module) => ({
    default: module.LoginPage,
  })),
)
const AssetDetailsPage = lazy(() =>
  import('./assets/AssetDetailsPage').then((module) => ({
    default: module.AssetDetailsPage,
  })),
)
const AssetsPage = lazy(() =>
  import('./assets/AssetsPage').then((module) => ({
    default: module.AssetsPage,
  })),
)
const UsersPage = lazy(() =>
  import('./users/UsersPage').then((module) => ({
    default: module.UsersPage,
  })),
)
const TicketCategoriesPage = lazy(() =>
  import('./tickets/TicketCategoriesPage').then((module) => ({
    default: module.TicketCategoriesPage,
  })),
)
const TicketDetailsPage = lazy(() =>
  import('./tickets/TicketDetailsPage').then((module) => ({
    default: module.TicketDetailsPage,
  })),
)
const TicketsPage = lazy(() =>
  import('./tickets/TicketsPage').then((module) => ({
    default: module.TicketsPage,
  })),
)
const AuditLogsPage = lazy(() =>
  import('./dashboard/AuditLogsPage').then((module) => ({
    default: module.AuditLogsPage,
  })),
)
const DashboardPage = lazy(() =>
  import('./dashboard/DashboardPage').then((module) => ({
    default: module.DashboardPage,
  })),
)
const ReportsPage = lazy(() =>
  import('./dashboard/ReportsPage').then((module) => ({
    default: module.ReportsPage,
  })),
)

interface HealthResponse {
  status: 'ok'
  service: string
  timestamp: string
}

function HomePage() {
  const { status } = useAuth()
  const [apiStatus, setApiStatus] = useState<
    'loading' | 'available' | 'unavailable'
  >('loading')

  const loadApiStatus = useCallback(async () => {
    try {
      await apiRequest<HealthResponse>('health')
      return 'available' as const
    } catch {
      return 'unavailable' as const
    }
  }, [])

  useEffect(() => {
    let active = true
    void loadApiStatus().then((status) => {
      if (active) {
        setApiStatus(status)
      }
    })
    return () => {
      active = false
    }
  }, [loadApiStatus])

  const retryApi = async () => {
    setApiStatus('loading')
    setApiStatus(await loadApiStatus())
  }

  if (status === 'authenticated') {
    return <Navigate to="/dashboard" replace />
  }

  return (
    <main className="page">
      <p className="eyebrow">IT Asset &amp; Service Management</p>
      <h1>IT Asset &amp; Service Management</h1>
      <p className="intro">Manage your IT services and assets.</p>
      <p>
        <Link className="button-link button-primary" to="/login">
          Sign in
        </Link>
      </p>
      <section aria-labelledby="api-status-heading" className="status-card">
        <h2 id="api-status-heading">API connection</h2>
        <p aria-live="polite">
          {apiStatus === 'loading' && 'Checking API availability…'}
          {apiStatus === 'available' && 'API is available.'}
          {apiStatus === 'unavailable' &&
            'API is unavailable. Start the backend and try again.'}
        </p>
        {apiStatus === 'unavailable' && (
          <button
            type="button"
            onClick={() => {
              void retryApi()
            }}
          >
            Retry
          </button>
        )}
      </section>
    </main>
  )
}

function AdminPage() {
  const [access, setAccess] = useState<'loading' | 'granted' | 'denied'>(
    'loading',
  )
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    void apiRequest<{ access: 'granted' }>('admin/access-check')
      .then(() => {
        if (active) setAccess('granted')
      })
      .catch((cause: unknown) => {
        if (active) {
          setAccess('denied')
          setError(
            cause instanceof Error ? cause.message : 'Access was denied.',
          )
        }
      })
    return () => {
      active = false
    }
  }, [])

  return (
    <main className="page">
      <h1>Admin access check</h1>
      {access === 'loading' && <p role="status">Checking permissions…</p>}
      {access === 'granted' && <p>Administrator permission verified.</p>}
      {access === 'denied' && <p role="alert">{error}</p>}
      <Link to="/">Return home</Link>
    </main>
  )
}

function NotFoundPage() {
  return (
    <main className="page">
      <h1>Page not found</h1>
      <p>The page you requested does not exist.</p>
      <Link to="/">Return home</Link>
    </main>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Suspense
          fallback={
            <main className="page">
              <p role="status">Loading page…</p>
            </main>
          }
        >
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route element={<RequireAuth />}>
              <Route element={<AuthenticatedLayout />}>
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route
                  element={
                    <RequireAnyPermission
                      permissions={['tickets.read.all', 'tickets.read.own']}
                    />
                  }
                >
                  <Route path="/tickets" element={<TicketsPage />} />
                  <Route path="/tickets/:id" element={<TicketDetailsPage />} />
                </Route>
                <Route element={<RequirePermission permission="users.read" />}>
                  <Route path="/users" element={<UsersPage />} />
                </Route>
                <Route element={<RequirePermission permission="assets.read" />}>
                  <Route path="/assets" element={<AssetsPage />} />
                  <Route path="/assets/:id" element={<AssetDetailsPage />} />
                </Route>
                <Route
                  element={<RequirePermission permission="tickets.update" />}
                >
                  <Route
                    path="/ticket-categories"
                    element={<TicketCategoriesPage />}
                  />
                </Route>
                <Route
                  element={<RequirePermission permission="reports.read" />}
                >
                  <Route path="/reports" element={<ReportsPage />} />
                </Route>
                <Route element={<RequirePermission permission="audit.read" />}>
                  <Route path="/audit-logs" element={<AuditLogsPage />} />
                </Route>
                <Route element={<RequirePermission permission="users.read" />}>
                  <Route path="/admin" element={<AdminPage />} />
                </Route>
              </Route>
            </Route>
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
