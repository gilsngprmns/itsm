import { Link, Navigate } from 'react-router-dom'
import { useAuth } from './auth/AuthContext'

export function HomePage() {
  const { status } = useAuth()

  if (status === 'authenticated') {
    return <Navigate to="/dashboard" replace />
  }

  return (
    <main className="home-page">
      <section className="home-hero">
        <div aria-hidden="true" className="home-hero-glow" />
        <div className="home-hero-content">
          <div className="home-hero-center">
            <h1>IT Asset Management</h1>
            <Link className="home-login-button" to="/login">
              Login
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}
