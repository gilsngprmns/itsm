import { useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

interface NavigationItem {
  to: string
  label: string
  permission: string | string[]
  end?: boolean
}

const navigation: NavigationItem[] = [
  { to: '/dashboard', label: 'Dashboard', permission: [] },
  {
    to: '/tickets',
    label: 'Tickets',
    permission: ['tickets.read.all', 'tickets.read.own'],
  },
  { to: '/assets', label: 'Assets', permission: 'assets.read' },
  { to: '/users', label: 'Users', permission: 'users.read' },
  { to: '/reports', label: 'Reports', permission: 'reports.read' },
  { to: '/audit-logs', label: 'Audit logs', permission: 'audit.read' },
  {
    to: '/ticket-categories',
    label: 'Ticket categories',
    permission: 'tickets.update',
  },
]

function hasPermission(
  permissions: string[],
  required: string | string[],
): boolean {
  if (Array.isArray(required)) {
    return required.some((permission) => permissions.includes(permission))
  }
  return permissions.includes(required)
}

function currentPage(pathname: string): string {
  const item = [...navigation]
    .filter((entry) => entry.to !== '/dashboard')
    .sort((left, right) => right.to.length - left.to.length)
    .find(
      (entry) => pathname === entry.to || pathname.startsWith(`${entry.to}/`),
    )
  return item?.label ?? 'Dashboard'
}

export function AuthenticatedLayout() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [signOutError, setSignOutError] = useState<string | null>(null)
  const visibleNavigation = navigation.filter((item) =>
    item.permission.length === 0
      ? true
      : hasPermission(user?.permissions ?? [], item.permission),
  )

  const logout = async () => {
    setSignOutError(null)
    try {
      await signOut()
      navigate('/login', { replace: true })
    } catch {
      setSignOutError('Unable to sign out. Please try again.')
    }
  }

  return (
    <div className="app-shell">
      <aside
        aria-label="Application navigation"
        className={`app-sidebar${mobileMenuOpen ? ' app-sidebar-open' : ''}`}
      >
        <NavLink
          aria-label="IT Asset and Service Management home"
          className="app-brand"
          onClick={() => setMobileMenuOpen(false)}
          to="/dashboard"
        >
          <span aria-hidden="true" className="brand-mark">
            IT
          </span>
          <span className="brand-name">
            IT Service
            <small>Asset management</small>
          </span>
        </NavLink>
        <p className="sidebar-section-label">Workspace</p>
        <nav aria-label="Main navigation" className="sidebar-navigation">
          {visibleNavigation.map((item) => (
            <NavLink
              aria-current={location.pathname === item.to ? 'page' : undefined}
              className={({ isActive }) =>
                `sidebar-link${isActive ? ' sidebar-link-active' : ''}`
              }
              end={item.end ?? item.to === '/dashboard'}
              key={item.to}
              onClick={() => setMobileMenuOpen(false)}
              to={item.to}
            >
              <span aria-hidden="true" className="sidebar-link-marker" />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-account">
          <div className="sidebar-user">
            <span aria-hidden="true" className="user-avatar">
              {user?.fullName.slice(0, 1).toUpperCase() ?? '?'}
            </span>
            <span className="sidebar-user-copy">
              <strong>{user?.fullName}</strong>
              <small>{user?.roles.join(', ')}</small>
            </span>
          </div>
          <button className="sidebar-signout" onClick={() => void logout()}>
            Sign out
          </button>
          {signOutError && (
            <p className="sidebar-error" role="alert">
              {signOutError}
            </p>
          )}
        </div>
      </aside>
      {mobileMenuOpen && (
        <button
          aria-label="Close navigation"
          className="sidebar-backdrop"
          onClick={() => setMobileMenuOpen(false)}
          type="button"
        />
      )}
      <div className="app-main">
        <header className="app-topbar">
          <button
            aria-expanded={mobileMenuOpen}
            aria-label={mobileMenuOpen ? 'Close navigation' : 'Open navigation'}
            className="mobile-menu-toggle"
            onClick={() => setMobileMenuOpen((open) => !open)}
            type="button"
          >
            <span aria-hidden="true" className="hamburger-lines">
              <span />
              <span />
              <span />
            </span>
          </button>
          <div className="topbar-context">
            <span className="topbar-section">
              IT Asset &amp; Service Management
            </span>
            <span aria-hidden="true" className="topbar-separator">
              /
            </span>
            <strong>{currentPage(location.pathname)}</strong>
          </div>
          <div className="topbar-user">
            <span aria-hidden="true" className="user-avatar user-avatar-small">
              {user?.fullName.slice(0, 1).toUpperCase() ?? '?'}
            </span>
            <span>{user?.fullName}</span>
          </div>
        </header>
        <div className="app-content">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
