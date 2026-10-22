import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { ApiRequestError } from '../lib/api'
import { useAuth } from './AuthContext'

export function LoginPage() {
  const { status, signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (status === 'loading') {
    return (
      <main className="page">
        <p role="status">Checking your session…</p>
      </main>
    )
  }
  if (status === 'authenticated') {
    return <Navigate to="/dashboard" replace />
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await signIn(email, password)
      const from = (location.state as { from?: unknown } | null)?.from
      navigate(
        typeof from === 'string' &&
          from.startsWith('/') &&
          !from.startsWith('//')
          ? from
          : '/dashboard',
        { replace: true },
      )
    } catch (cause) {
      if (cause instanceof ApiRequestError && cause.status === 401) {
        setError('Invalid email or password.')
      } else if (cause instanceof ApiRequestError && cause.status === 429) {
        setError('Too many login attempts. Try again later.')
      } else {
        setError(
          cause instanceof Error
            ? cause.message
            : 'Unable to sign in. Please try again.',
        )
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="login-page">
      <section aria-labelledby="login-heading" className="login-card">
        <div className="login-form-column">
          <Link className="login-brand" to="/">
            <span aria-hidden="true" className="brand-mark">
              IT
            </span>
            <span>
              IT Asset &amp; Service
              <small>Management</small>
            </span>
          </Link>
          <p className="eyebrow">Secure workspace</p>
          <h1 id="login-heading">Sign in</h1>
          <p className="intro">Use your organization account to continue.</p>
          <form className="auth-form" onSubmit={(event) => void submit(event)}>
            <label htmlFor="email">Email</label>
            <input
              autoComplete="username"
              id="email"
              maxLength={254}
              onChange={(event) => setEmail(event.target.value)}
              required
              type="email"
              value={email}
            />
            <label htmlFor="password">Password</label>
            <input
              autoComplete="current-password"
              id="password"
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
            {status === 'unavailable' && (
              <p role="alert">The API is unavailable. Check your connection.</p>
            )}
            {error && <p role="alert">{error}</p>}
            <button
              className="button-primary"
              disabled={submitting}
              type="submit"
            >
              {submitting ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
          <Link className="login-return" to="/">
            Return home
          </Link>
        </div>
        <aside aria-label="IT service workspace" className="login-visual">
          <p className="login-visual-eyebrow">Operations workspace</p>
          <h2>IT services, clearly in view.</h2>
          <p>
            A focused workspace for service requests, assets, and operational
            accountability.
          </p>
          <ul>
            <li>Track requests through their lifecycle</li>
            <li>Keep asset assignments and history together</li>
            <li>Review operational activity with role-aware access</li>
          </ul>
          <span aria-hidden="true" className="login-visual-orbit">
            <span>IT</span>
          </span>
        </aside>
      </section>
    </main>
  )
}
