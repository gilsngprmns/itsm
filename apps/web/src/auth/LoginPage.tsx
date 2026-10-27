import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { loginFailureMessage, postLoginPath } from './login-utils'

export function LoginPage() {
  const { status, signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const errorRef = useRef<HTMLParagraphElement>(null)

  useEffect(() => {
    if (error) errorRef.current?.focus()
  }, [error])

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
      navigate(postLoginPath(location.state), { replace: true })
    } catch (cause) {
      setError(loginFailureMessage(cause))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="login-page">
      <div className="login-shell">
        <section aria-labelledby="login-heading" className="login-card">
          <aside className="login-visual">
            <div aria-hidden="true" className="login-visual-wave" />
            <Link className="login-visual-title" to="/">
              IT Asset Management
            </Link>
            <div aria-hidden="true" className="login-illustration">
              <div className="login-illustration-orbit login-orbit-one" />
              <div className="login-illustration-orbit login-orbit-two" />
              <div className="login-device">
                <div className="login-device-top">
                  <span />
                  <span />
                  <span />
                </div>
                <div className="login-device-screen">
                  <div className="login-device-sidebar">
                    <i />
                    <i />
                    <i />
                    <i />
                  </div>
                  <div className="login-device-content">
                    <span className="login-device-caption" />
                    <span className="login-device-heading" />
                    <div className="login-device-metrics">
                      <i />
                      <i />
                      <i />
                    </div>
                    <div className="login-device-list">
                      <i />
                      <i />
                      <i />
                    </div>
                  </div>
                </div>
              </div>
              <div className="login-asset-float login-asset-laptop">
                <span className="login-asset-icon">▱</span>
                <span>
                  <i />
                  <i />
                </span>
                <b>✓</b>
              </div>
              <div className="login-asset-float login-asset-ticket">
                <span className="login-ticket-icon">↗</span>
                <span>
                  <i />
                  <i />
                </span>
                <b />
              </div>
              <div className="login-plant login-plant-left">
                <i />
                <i />
                <i />
              </div>
              <div className="login-plant login-plant-right">
                <i />
                <i />
                <i />
              </div>
            </div>
            <div aria-hidden="true" className="login-visual-foot">
              <span>ASSETS</span>
              <i />
              <span>SERVICE</span>
              <i />
              <span>TEAM</span>
            </div>
          </aside>
          <div className="login-panel">
            <div className="login-heading">
              <h1 id="login-heading">Login</h1>
              <p>Sign in with your work account to continue.</p>
            </div>
            <form
              className="auth-form"
              onSubmit={(event) => void submit(event)}
            >
              <label htmlFor="email">Email address</label>
              <input
                autoComplete="username"
                autoFocus
                id="email"
                maxLength={254}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@company.com"
                required
                type="email"
                value={email}
              />
              <label htmlFor="password">Password</label>
              <div className="password-field">
                <input
                  autoComplete="current-password"
                  id="password"
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter your password"
                  required
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                />
                <button
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="password-toggle"
                  onClick={() => setShowPassword((visible) => !visible)}
                  type="button"
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
              {status === 'unavailable' && (
                <p role="alert">
                  The API is unavailable. Check your connection.
                </p>
              )}
              {error && (
                <p ref={errorRef} role="alert" tabIndex={-1}>
                  {error}
                </p>
              )}
              <button
                className="button-primary"
                disabled={submitting}
                type="submit"
              >
                {submitting ? 'Signing in…' : 'Login'}
              </button>
            </form>
            <p className="login-security-note">
              <span aria-hidden="true" className="login-security-icon">
                ✓
              </span>
              Secure access to your IT workspace
            </p>
            <Link
              aria-label="Return to home"
              className="login-back-link"
              to="/"
            >
              Back to home
            </Link>
          </div>
        </section>
      </div>
    </main>
  )
}
