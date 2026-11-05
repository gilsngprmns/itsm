import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '../common/PageHeader'
import { apiRequest } from '../lib/api'

interface BarcodeDetectorResult {
  rawValue: string
}

interface BarcodeDetectorInstance {
  detect(source: HTMLVideoElement): Promise<BarcodeDetectorResult[]>
}

interface BarcodeDetectorConstructor {
  new (options?: { formats?: string[] }): BarcodeDetectorInstance
}

function assetCodeFromScan(rawValue: string): string {
  const value = rawValue.trim()
  try {
    const url = new URL(value)
    const marker = '/assets/by-code/'
    const markerIndex = url.pathname.indexOf(marker)
    if (markerIndex >= 0) {
      return decodeURIComponent(url.pathname.slice(markerIndex + marker.length))
    }
  } catch {
    // QR values may be plain asset codes.
  }
  return value
}

export function AssetScanPage() {
  const navigate = useNavigate()
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const scanningRef = useRef(false)
  const [manualCode, setManualCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cameraAvailable, setCameraAvailable] = useState(true)

  const lookup = useCallback(async (rawValue: string) => {
    const assetCode = assetCodeFromScan(rawValue)
    if (!assetCode) return
    setLoading(true)
    setError(null)
    try {
      const asset = await apiRequest<{ id: string }>(
        `assets/by-code/${encodeURIComponent(assetCode)}`,
      )
      navigate(`/assets/${asset.id}`, { replace: true })
    } catch (cause) {
      setError(
        cause instanceof Error && 'status' in cause
          ? 'This asset was not found or you do not have access.'
          : 'Unable to look up this asset.',
      )
      setLoading(false)
    }
  }, [navigate])

  const submitManual = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void lookup(manualCode)
  }

  useEffect(() => {
    let active = true
    const browserWindow = window as typeof window & {
      BarcodeDetector?: BarcodeDetectorConstructor
    }
    if (!navigator.mediaDevices?.getUserMedia || !browserWindow.BarcodeDetector) {
      queueMicrotask(() => {
        if (active) setCameraAvailable(false)
      })
      return
    }

    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        })
        if (!active) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }
        streamRef.current = stream
        if (!videoRef.current) return
        videoRef.current.srcObject = stream
        await videoRef.current.play()
        const detector = new browserWindow.BarcodeDetector!({
          formats: ['qr_code', 'code_128', 'ean_13'],
        })
        const scan = async () => {
          if (!active || scanningRef.current || !videoRef.current) return
          scanningRef.current = true
          try {
            const results = await detector.detect(videoRef.current)
            const code = results[0]?.rawValue
            if (code) await lookup(code)
          } catch {
            // Keep scanning when a video frame is not readable.
          } finally {
            scanningRef.current = false
            if (active) window.requestAnimationFrame(() => void scan())
          }
        }
        window.requestAnimationFrame(() => void scan())
      } catch {
        if (active) {
          setCameraAvailable(false)
          setError(
            'Camera access is unavailable. Enter the asset code manually below.',
          )
        }
      }
    }
    void startCamera()
    return () => {
      active = false
      streamRef.current?.getTracks().forEach((track) => track.stop())
    }
  }, [lookup])

  return (
    <main className="page management-page">
      <PageHeader
        title="Scan asset"
        description="Scan an asset QR code or enter the asset code manually."
      />
      {error && (
        <p className="error-banner" role="alert">
          {error}
        </p>
      )}
      {cameraAvailable && (
        <section className="detail-panel" aria-label="Asset camera scanner">
          <video
            ref={videoRef}
            muted
            playsInline
            aria-label="Camera view for scanning an asset code"
          />
        </section>
      )}
      <section className="form-panel" aria-labelledby="manual-asset-code-heading">
        <h2 id="manual-asset-code-heading">Enter asset code</h2>
        <form className="filter-form" onSubmit={submitManual}>
          <label>
            Asset code
            <input
              required
              value={manualCode}
              onChange={(event) => setManualCode(event.target.value)}
            />
          </label>
          <button disabled={loading || !manualCode.trim()} type="submit">
            {loading ? 'Looking up…' : 'Open asset'}
          </button>
        </form>
      </section>
    </main>
  )
}
