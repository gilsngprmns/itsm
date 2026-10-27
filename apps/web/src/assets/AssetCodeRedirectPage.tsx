import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { apiRequest } from '../lib/api'

export function AssetCodeRedirectPage() {
  const { code = '' } = useParams()
  const navigate = useNavigate()
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    void apiRequest<{ id: string }>(
      `assets/by-code/${encodeURIComponent(code)}`,
    )
      .then((asset) => {
        if (active) navigate(`/assets/${asset.id}`, { replace: true })
      })
      .catch(() => {
        if (active)
          setError('This asset was not found or you do not have access.')
      })
    return () => {
      active = false
    }
  }, [code, navigate])

  return (
    <main className="page">
      <h1>Asset lookup</h1>
      {error ? (
        <>
          <p role="alert">{error}</p>
          <Link to="/assets">Back to assets</Link>
        </>
      ) : (
        <p role="status">Opening asset…</p>
      )}
    </main>
  )
}
