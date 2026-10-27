import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

interface NavigationItem {
  to: string
  label: string
  icon: NavigationIcon
  permission: string | string[]
  end?: boolean
}

type NavigationIcon =
  | 'dashboard'
  | 'tickets'
  | 'assets'
  | 'master-data'
  | 'users'
  | 'reports'
  | 'audit-logs'
  | 'ticket-categories'

const navigation: NavigationItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: 'dashboard', permission: [] },
  {
    to: '/tickets',
    label: 'Tickets',
    icon: 'tickets',
    permission: ['tickets.read.all', 'tickets.read.own'],
  },
  { to: '/assets', label: 'Assets', icon: 'assets', permission: 'assets.read' },
  {
    to: '/master-data',
    label: 'Master data',
    icon: 'master-data',
    permission: [
      'assets.read',
      'tickets.read.all',
      'tickets.read.own',
      'users.read',
    ],
  },
  { to: '/users', label: 'Users', icon: 'users', permission: 'users.read' },
  {
    to: '/reports',
    label: 'Reports',
    icon: 'reports',
    permission: 'reports.read',
  },
  {
    to: '/audit-logs',
    label: 'Audit logs',
    icon: 'audit-logs',
    permission: 'audit.read',
  },
  {
    to: '/ticket-categories',
    label: 'Ticket categories',
    icon: 'ticket-categories',
    permission: 'tickets.update',
  },
]

function NavigationIconGraphic({ name }: { name: NavigationIcon }) {
  const common = {
    fill: 'none',
    stroke: 'currentColor',
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    strokeWidth: 1.7,
  }

  switch (name) {
    case 'dashboard':
      return (
        <svg
          aria-hidden="true"
          data-icon={name}
          viewBox="0 0 24 24"
          {...common}
        >
          <rect x="3.5" y="3.5" width="7" height="7" rx="1.4" />
          <rect x="13.5" y="3.5" width="7" height="7" rx="1.4" />
          <rect x="3.5" y="13.5" width="7" height="7" rx="1.4" />
          <rect x="13.5" y="13.5" width="7" height="7" rx="1.4" />
        </svg>
      )
    case 'tickets':
      return (
        <svg
          aria-hidden="true"
          data-icon={name}
          viewBox="0 0 24 24"
          {...common}
        >
          <path d="M4 6.5h16v4a2.5 2.5 0 0 0 0 5v2H4v-2a2.5 2.5 0 0 0 0-5v-4Z" />
          <path d="M12 8.5v1m0 2v1m0 2v1" />
        </svg>
      )
    case 'assets':
      return (
        <svg
          aria-hidden="true"
          data-icon={name}
          viewBox="0 0 24 24"
          {...common}
        >
          <path d="m12 3.5 8 4.25v8.5l-8 4.25-8-4.25v-8.5l8-4.25Z" />
          <path d="m4.5 8 7.5 4 7.5-4M12 12v8" />
        </svg>
      )
    case 'master-data':
      return (
        <svg
          aria-hidden="true"
          data-icon={name}
          viewBox="0 0 24 24"
          {...common}
        >
          <path d="m12 3.5 8 4-8 4-8-4 8-4Z" />
          <path d="m4 12 8 4 8-4M4 16.5l8 4 8-4" />
        </svg>
      )
    case 'users':
      return (
        <svg
          aria-hidden="true"
          data-icon={name}
          viewBox="0 0 24 24"
          {...common}
        >
          <circle cx="9" cy="8" r="3.25" />
          <path d="M3.5 19v-1.2A4.8 4.8 0 0 1 8.3 13h1.4a4.8 4.8 0 0 1 4.8 4.8V19h-11Z" />
          <path d="M15 5.2a3.25 3.25 0 0 1 0 6.1m2.2 2.2a4.8 4.8 0 0 1 3.3 4.5V19h-3.2" />
        </svg>
      )
    case 'reports':
      return (
        <svg
          aria-hidden="true"
          data-icon={name}
          viewBox="0 0 24 24"
          {...common}
        >
          <path d="M4 20V4m0 16h17" />
          <path d="m7 15 4-4 3 2 5-6" />
          <path d="M16 7h3v3" />
        </svg>
      )
    case 'audit-logs':
      return (
        <svg
          aria-hidden="true"
          data-icon={name}
          viewBox="0 0 24 24"
          {...common}
        >
          <path d="M8 4.5h8a2 2 0 0 1 2 2v14H6v-14a2 2 0 0 1 2-2Z" />
          <path d="M9 4.5v-1h6v1M9 10h6m-6 4h6m-6 4h4" />
        </svg>
      )
    case 'ticket-categories':
      return (
        <svg
          aria-hidden="true"
          data-icon={name}
          viewBox="0 0 24 24"
          {...common}
        >
          <path d="M4 5.5h16v4a2.5 2.5 0 0 0 0 5v4H4v-4a2.5 2.5 0 0 0 0-5v-4Z" />
          <path d="M9 9.5h6m-6 5h6" />
        </svg>
      )
  }
}

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
  const menuToggleRef = useRef<HTMLButtonElement>(null)
  const sidebarRef = useRef<HTMLElement>(null)
  const visibleNavigation = navigation.filter((item) =>
    item.permission.length === 0
      ? true
      : hasPermission(user?.permissions ?? [], item.permission),
  )

  useEffect(() => {
    if (!mobileMenuOpen) return
    const mobileViewport = window.matchMedia('(max-width: 760px)')
    if (!mobileViewport.matches) return
    const sidebar = sidebarRef.current
    const focusableElements = () =>
      Array.from(
        sidebar?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      )
    sidebar?.querySelector<HTMLElement>('.sidebar-link')?.focus()
    const handleKeydown = (event: KeyboardEvent) => {
      if (!mobileViewport.matches) return
      if (event.key === 'Escape') {
        setMobileMenuOpen(false)
        menuToggleRef.current?.focus()
        return
      }
      if (event.key !== 'Tab') return
      const elements = focusableElements()
      const first = elements[0]
      const last = elements[elements.length - 1]
      if (!first || !last) return
      if (
        event.shiftKey &&
        (document.activeElement === first ||
          !sidebar?.contains(document.activeElement))
      ) {
        event.preventDefault()
        last.focus()
      } else if (
        !event.shiftKey &&
        (document.activeElement === last ||
          !sidebar?.contains(document.activeElement))
      ) {
        event.preventDefault()
        first.focus()
      }
    }
    const closeOnDesktop = () => {
      if (!mobileViewport.matches) setMobileMenuOpen(false)
    }
    document.addEventListener('keydown', handleKeydown)
    window.addEventListener('resize', closeOnDesktop)
    return () => {
      document.removeEventListener('keydown', handleKeydown)
      window.removeEventListener('resize', closeOnDesktop)
    }
  }, [mobileMenuOpen])

  const closeMobileMenu = () => {
    setMobileMenuOpen(false)
    menuToggleRef.current?.focus()
  }

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
        ref={sidebarRef}
      >
        <NavLink
          aria-label="IT Asset and Service Management home"
          className="app-brand"
          onClick={() => setMobileMenuOpen(false)}
          to="/dashboard"
        >
          <span aria-hidden="true" className="sidebar-brand-mark">
            <svg
              fill="none"
              height="24"
              viewBox="0 0 24 24"
              width="24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M4.5 7.25 12 3.5l7.5 3.75v9.5L12 20.5l-7.5-3.75v-9.5Z"
                stroke="currentColor"
                strokeLinejoin="round"
                strokeWidth="1.6"
              />
              <path
                d="m4.9 7.45 7.1 3.6 7.1-3.6M12 11.2v9M8.4 5.3l7.2 3.6"
                stroke="currentColor"
                strokeLinejoin="round"
                strokeWidth="1.4"
              />
            </svg>
          </span>
          <span className="brand-name">IT Asset &amp; Service Management</span>
        </NavLink>
        <nav
          aria-label="Main navigation"
          className="sidebar-navigation"
          id="primary-navigation"
        >
          {visibleNavigation.map((item) => (
            <NavLink
              className={({ isActive }) =>
                `sidebar-link${isActive ? ' sidebar-link-active' : ''}`
              }
              end={item.end ?? item.to === '/dashboard'}
              key={item.to}
              onClick={closeMobileMenu}
              to={item.to}
            >
              <NavigationIconGraphic name={item.icon} />
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
          onClick={closeMobileMenu}
          type="button"
        />
      )}
      <div className="app-main">
        <header className="app-topbar">
          <button
            aria-expanded={mobileMenuOpen}
            aria-controls="primary-navigation"
            aria-label={mobileMenuOpen ? 'Close navigation' : 'Open navigation'}
            className="mobile-menu-toggle"
            onClick={() => setMobileMenuOpen((open) => !open)}
            ref={menuToggleRef}
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
