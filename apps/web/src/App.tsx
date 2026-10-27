import { lazy, Suspense, useEffect, useState } from 'react'
import { BrowserRouter, Link, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import { RequirePermission } from './auth/RequirePermission'
import { RequireAnyPermission } from './auth/RequireAnyPermission'
import { RequireAuth } from './auth/RequireAuth'
import { apiRequest } from './lib/api'
import { AuthenticatedLayout } from './app/AuthenticatedLayout'
import { HomePage } from './HomePage'
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
const AssetCodeRedirectPage = lazy(() =>
  import('./assets/AssetCodeRedirectPage').then((module) => ({
    default: module.AssetCodeRedirectPage,
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
const TicketPrintPage = lazy(() =>
  import('./tickets/TicketPrintPage').then((module) => ({
    default: module.TicketPrintPage,
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
const MasterDataPage = lazy(() =>
  import('./master-data/MasterDataPage').then((module) => ({
    default: module.MasterDataPage,
  })),
)
const ReportsPage = lazy(() =>
  import('./dashboard/ReportsPage').then((module) => ({
    default: module.ReportsPage,
  })),
)

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
      .catch(() => {
        if (active) {
          setAccess('denied')
          setError(
            'Could not verify administrator access. Return home and sign in again.',
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
                      permissions={[
                        'assets.read',
                        'tickets.read.all',
                        'tickets.read.own',
                        'users.read',
                      ]}
                    />
                  }
                >
                  <Route path="/master-data" element={<MasterDataPage />} />
                </Route>
                <Route
                  element={
                    <RequireAnyPermission
                      permissions={['tickets.read.all', 'tickets.read.own']}
                    />
                  }
                >
                  <Route path="/tickets" element={<TicketsPage />} />
                  <Route
                    path="/tickets/:id/print"
                    element={<TicketPrintPage />}
                  />
                  <Route path="/tickets/:id" element={<TicketDetailsPage />} />
                </Route>
                <Route element={<RequirePermission permission="users.read" />}>
                  <Route path="/users" element={<UsersPage />} />
                </Route>
                <Route element={<RequirePermission permission="assets.read" />}>
                  <Route path="/assets" element={<AssetsPage />} />
                  <Route
                    path="/assets/by-code/:code"
                    element={<AssetCodeRedirectPage />}
                  />
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
