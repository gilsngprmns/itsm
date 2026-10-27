import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { EmptyState, ErrorBanner } from './common/Feedback'
import { StatusBadge, statusLabel } from './common/StatusBadge'
import { LoginPage } from './auth/LoginPage'
import { useAuth } from './auth/AuthContext'
import { HomePage } from './HomePage'
import { loginFailureMessage, postLoginPath } from './auth/login-utils'
import { ApiRequestError } from './lib/api'
import { dashboardRole } from './dashboard/dashboard-role'
import { STATUS_TRANSITIONS } from './tickets/ticket-types'
import { AssetCsvTools } from './assets/AssetCsvTools'
import { MasterDataPage } from './master-data/MasterDataPage'
import { AuthenticatedLayout } from './app/AuthenticatedLayout'
import { ticketErrorMessage } from './tickets/ticket-errors'

vi.mock('./auth/AuthContext', () => ({
  useAuth: vi.fn(() => ({
    status: 'anonymous',
    user: null,
    error: null,
    refresh: vi.fn(),
    signIn: vi.fn(),
    signOut: vi.fn(),
  })),
}))

describe('login form', () => {
  it('requires a valid email and password and shows the password control', () => {
    const markup = renderToStaticMarkup(
      createElement(MemoryRouter, null, createElement(LoginPage)),
    )

    expect(markup).toContain('type="email"')
    expect(markup).toContain('type="password"')
    expect(markup).toContain('required=""')
    expect(markup).toContain('aria-label="Show password"')
    expect(markup).toContain('Login')
    expect(markup).toContain('IT Asset Management')
    expect(markup).toContain('login-visual')
    expect(markup).toContain('login-panel')
    expect(markup).toContain('login-shell')
    expect(markup).not.toContain('IT OPERATIONS WORKSPACE')
    expect(markup).not.toContain('Asset overview')
    expect(markup).not.toContain('Device inventory')
    expect(markup).toContain('Secure access to your IT workspace')
  })

  it('uses clear authentication errors without exposing account existence', () => {
    const message = loginFailureMessage(
      new ApiRequestError(401, 'unauthorized'),
    )
    const markup = renderToStaticMarkup(
      createElement(ErrorBanner, null, message),
    )
    expect(message).toBe('Email or password is incorrect.')
    expect(markup).toContain('role="alert"')
    expect(markup).toContain('Email or password is incorrect.')
    expect(loginFailureMessage(new ApiRequestError(429, 'limited'))).toBe(
      'Too many login attempts. Try again later.',
    )
  })

  it('returns to a safe requested path after sign in', () => {
    expect(postLoginPath({ from: '/tickets/123' })).toBe('/tickets/123')
    expect(postLoginPath({ from: '//example.com' })).toBe('/dashboard')
    expect(postLoginPath(null)).toBe('/dashboard')
  })

  it('shows CSV template, import, and export tools to explicitly permitted users', () => {
    vi.mocked(useAuth).mockReturnValue({
      status: 'authenticated',
      user: {
        id: 'admin-id',
        fullName: 'Admin',
        email: 'admin@example.test',
        roles: ['ADMIN'],
        permissions: ['assets.create', 'assets.read.all'],
      },
      error: null,
      refresh: vi.fn(),
      signIn: vi.fn(),
      signOut: vi.fn(),
    })
    const markup = renderToStaticMarkup(
      createElement(AssetCsvTools, {
        filters: {},
        onImported: vi.fn(),
      }),
    )
    expect(markup).toContain('Download template')
    expect(markup).toContain('Import CSV')
    expect(markup).toContain('Export filtered assets')
  })

  it('does not show master-data CSV controls without their permissions', () => {
    vi.mocked(useAuth).mockReturnValue({
      status: 'authenticated',
      user: {
        id: 'user-id',
        fullName: 'User',
        email: 'user@example.test',
        roles: ['USER'],
        permissions: ['assets.read'],
      },
      error: null,
      refresh: vi.fn(),
      signIn: vi.fn(),
      signOut: vi.fn(),
    })
    const markup = renderToStaticMarkup(
      createElement(AssetCsvTools, {
        filters: {},
        onImported: vi.fn(),
      }),
    )
    expect(markup).not.toContain('Import CSV')
    expect(markup).not.toContain('Export filtered assets')
  })

  it('shows permitted master-data sections and the existing user directory tab', () => {
    vi.mocked(useAuth).mockReturnValue({
      status: 'authenticated',
      user: {
        id: 'admin-id',
        fullName: 'Admin',
        email: 'admin@example.test',
        roles: ['ADMIN'],
        permissions: ['assets.read', 'users.read'],
      },
      error: null,
      refresh: vi.fn(),
      signIn: vi.fn(),
      signOut: vi.fn(),
    })
    const markup = renderToStaticMarkup(
      createElement(MemoryRouter, null, createElement(MasterDataPage)),
    )

    expect(markup).toContain('Master data')
    expect(markup).toContain('Asset categories')
    expect(markup).toContain('Departments')
    expect(markup).toContain('Vendors')
    expect(markup).toContain('IT team')
    expect(markup).not.toContain('Add asset category')
  })
})

describe('public landing page', () => {
  it('shows the IT Asset Management title and login button over the landing background', () => {
    vi.mocked(useAuth).mockReturnValue({
      status: 'anonymous',
      user: null,
      error: null,
      refresh: vi.fn(),
      signIn: vi.fn(),
      signOut: vi.fn(),
    })
    const markup = renderToStaticMarkup(
      createElement(MemoryRouter, null, createElement(HomePage)),
    )

    expect(markup).toContain('class="home-hero"')
    expect(markup).toContain('<h1>IT Asset Management</h1>')
    expect(markup).toContain('>Login</a>')
    expect(markup).toContain('href="/login"')
    expect(markup).not.toContain('home-brand-mark')
    expect(markup).not.toContain('Platform')
    expect(markup).not.toContain('API connected')
  })
})

describe('authenticated application shell', () => {
  it('labels the mobile navigation control and respects navigation permissions', () => {
    vi.mocked(useAuth).mockReturnValue({
      status: 'authenticated',
      user: {
        id: 'admin-id',
        fullName: 'Admin',
        email: 'admin@example.test',
        roles: ['ADMIN'],
        permissions: ['assets.read', 'users.read', 'tickets.read.all'],
      },
      error: null,
      refresh: vi.fn(),
      signIn: vi.fn(),
      signOut: vi.fn(),
    })
    const markup = renderToStaticMarkup(
      createElement(MemoryRouter, null, createElement(AuthenticatedLayout)),
    )

    expect(markup).toContain('aria-controls="primary-navigation"')
    expect(markup).toContain('aria-expanded="false"')
    expect(markup).toContain('class="sidebar-brand-mark"')
    expect(markup).toContain('IT Asset &amp; Service Management')
    expect(markup).toContain('id="primary-navigation"')
    expect(markup).toContain('data-icon="dashboard"')
    expect(markup).toContain('data-icon="tickets"')
    expect(markup).toContain('>Dashboard</a>')
    expect(markup).toContain('>Tickets</a>')
    expect(markup).toContain('>Master data</a>')
    expect(markup).not.toContain('>Ticket categories</a>')
  })
})

describe('shared interface states', () => {
  it('shows status text alongside its marker', () => {
    const markup = renderToStaticMarkup(
      createElement(StatusBadge, { value: 'IN_PROGRESS' }),
    )

    expect(markup).toContain('In progress')
    expect(markup).toContain('aria-hidden="true"')
  })

  it('renders empty and error states with accessible text', () => {
    const emptyMarkup = renderToStaticMarkup(
      createElement(EmptyState, { message: 'No tickets yet.' }),
    )
    const errorMarkup = renderToStaticMarkup(
      createElement(
        ErrorBanner,
        null,
        'Tickets could not be loaded. Try again.',
      ),
    )

    expect(emptyMarkup).toContain('No tickets yet.')
    expect(errorMarkup).toContain('role="alert"')
    expect(errorMarkup).toContain('Tickets could not be loaded. Try again.')
  })
})

describe('role based dashboards', () => {
  it('selects the dashboard matching the user role', () => {
    expect(dashboardRole(['ADMIN', 'USER'])).toBe('ADMIN')
    expect(dashboardRole(['AUDIT'])).toBe('AUDIT')
    expect(dashboardRole(['USER'])).toBe('USER')
  })
})

describe('ticket status actions', () => {
  it('surfaces asset-option load failures as an actionable message', () => {
    expect(
      ticketErrorMessage(new Error('network error'), 'load eligible assets'),
    ).toBe('Unable to load eligible assets. Please try again.')
  })

  it('does not offer direct resolution from OPEN', () => {
    expect(STATUS_TRANSITIONS.OPEN).toEqual(['IN_PROGRESS', 'CANCELLED'])
  })

  it('presents the resolved lifecycle status as Solved', () => {
    expect(statusLabel('RESOLVED')).toBe('Solved')
  })
})
