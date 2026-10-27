import { useRef, useState, type ChangeEvent } from 'react'
import { useAuth } from '../auth/AuthContext'
import { ApiRequestError, buildApiUrl } from '../lib/api'

interface AssetCsvIssue {
  column: string
  code: string
  message: string
}

interface AssetCsvPreviewRow {
  rowNumber: number
  assetTag: string
  name: string
  categoryCode: string
  locationCode: string
  errors: AssetCsvIssue[]
  warnings: AssetCsvIssue[]
}

interface AssetCsvPreview {
  totalRows: number
  validRows: number
  invalidRows: number
  warningRows: number
  rows: AssetCsvPreviewRow[]
}

interface AssetCsvImportResult {
  operationId: string
  mode: 'CREATE_ONLY'
  totalRows: number
  createdRows: number
  updatedRows: 0
  rejectedRows: 0
}

interface AssetCsvFilters {
  search?: string
  status?: string
  categoryId?: string
  locationId?: string
}

class AssetCsvRequestError extends Error {
  readonly preview: AssetCsvPreview | undefined

  constructor(message: string, preview?: AssetCsvPreview) {
    super(message)
    this.name = 'AssetCsvRequestError'
    this.preview = preview
  }
}

export function AssetCsvTools({
  filters,
  onImported,
}: {
  filters: AssetCsvFilters
  onImported: () => void
}) {
  const { user } = useAuth()
  const canImport = user?.permissions.includes('assets.create') ?? false
  const canExport = user?.permissions.includes('assets.read.all') ?? false
  const [showImport, setShowImport] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<AssetCsvPreview | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const selectFile = (event: ChangeEvent<HTMLInputElement>) => {
    setFile(event.target.files?.[0] ?? null)
    setPreview(null)
    setError(null)
    setNotice(null)
  }

  const download = async (path: string, filename: string) => {
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const response = await fetch(buildApiUrl(path), {
        credentials: 'include',
        cache: 'no-store',
      })
      if (!response.ok) {
        if (response.status === 401) {
          window.dispatchEvent(new Event('api:unauthorized'))
        }
        throw new ApiRequestError(response.status, '')
      }
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = filename
      anchor.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (cause) {
      setError(
        cause instanceof ApiRequestError && cause.status === 403
          ? 'You do not have permission to download this file.'
          : 'The CSV download failed. Check your connection and try again.',
      )
    } finally {
      setBusy(false)
    }
  }

  const upload = async (endpoint: string): Promise<unknown> => {
    if (!file) throw new Error('Choose a CSV file first.')
    const form = new FormData()
    form.append('file', file)
    let response: Response
    try {
      response = await fetch(buildApiUrl(endpoint), {
        method: 'POST',
        credentials: 'include',
        cache: 'no-store',
        body: form,
      })
    } catch {
      throw new Error('The upload failed. Check your connection and try again.')
    }
    if (response.status === 401) {
      window.dispatchEvent(new Event('api:unauthorized'))
    }

    let body: unknown
    try {
      body = await response.json()
    } catch {
      throw new Error('The server returned an unreadable CSV response.')
    }

    if (!response.ok) {
      const responseBody = isRecord(body) ? body : {}
      const previewResult = isAssetCsvPreview(responseBody.preview)
        ? responseBody.preview
        : undefined
      throw new AssetCsvRequestError(
        readApiMessage(responseBody.message) ??
          `The server could not process the CSV (HTTP ${response.status}).`,
        previewResult,
      )
    }
    return body
  }

  const validate = async () => {
    setBusy(true)
    setError(null)
    setNotice(null)
    setPreview(null)
    try {
      const result = await upload('assets/import/preview')
      if (!isAssetCsvPreview(result)) {
        throw new Error('The server returned an invalid validation preview.')
      }
      setPreview(result)
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Unable to validate the CSV file.',
      )
    } finally {
      setBusy(false)
    }
  }

  const importAssets = async () => {
    if (!file || !preview || preview.invalidRows > 0) return
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const result = await upload('assets/import')
      if (!isAssetCsvImportResult(result)) {
        throw new Error('The server returned an invalid import summary.')
      }
      setNotice(`${result.createdRows} assets imported successfully.`)
      setFile(null)
      setPreview(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      onImported()
    } catch (cause) {
      if (cause instanceof AssetCsvRequestError && cause.preview) {
        setPreview(cause.preview)
      }
      setError(
        cause instanceof Error
          ? cause.message
          : 'Unable to import the CSV file.',
      )
    } finally {
      setBusy(false)
    }
  }

  const exportPath = buildExportPath(filters)

  return (
    <section className="asset-csv-tools" aria-label="CSV asset data tools">
      <div className="asset-csv-actions">
        {canImport && (
          <>
            <button
              disabled={busy}
              onClick={() =>
                void download(
                  'assets/import/template',
                  'asset-import-template.csv',
                )
              }
              type="button"
            >
              Download template
            </button>
            <button
              disabled={busy}
              onClick={() => {
                setShowImport((current) => !current)
                setError(null)
                setNotice(null)
              }}
              type="button"
            >
              {showImport ? 'Close CSV import' : 'Import CSV'}
            </button>
          </>
        )}
        {canExport && (
          <button
            disabled={busy}
            onClick={() => void download(exportPath, 'assets.csv')}
            type="button"
          >
            Export filtered assets
          </button>
        )}
      </div>

      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
      {error && (
        <p className="error-banner" role="alert">
          {error}
        </p>
      )}

      {showImport && canImport && (
        <div className="asset-csv-import">
          <h2>Import assets from CSV</h2>
          <p>
            Create-only import. Up to 500 rows and 5 MB per file. All rows are
            validated before an atomic import; existing assets are never
            overwritten. New assets start as Available and in Good condition.
          </p>
          <label className="asset-csv-file">
            CSV file
            <input
              accept=".csv,text/csv"
              disabled={busy}
              onChange={selectFile}
              ref={fileInputRef}
              type="file"
            />
          </label>
          <div className="asset-csv-actions">
            <button
              disabled={busy || !file}
              onClick={() => void validate()}
              type="button"
            >
              {busy ? 'Processing…' : 'Validate file'}
            </button>
            {preview?.invalidRows === 0 && (
              <button
                className="button-primary"
                disabled={busy || !file}
                onClick={() => void importAssets()}
                type="button"
              >
                Import {preview.validRows} assets
              </button>
            )}
            {preview && preview.invalidRows > 0 && (
              <button
                disabled={busy}
                onClick={() => downloadErrorReport(preview)}
                type="button"
              >
                Download error report
              </button>
            )}
          </div>
          {preview && (
            <>
              <div className="asset-csv-summary" aria-live="polite">
                <span>{preview.totalRows} rows</span>
                <span>{preview.validRows} valid</span>
                <span>{preview.invalidRows} invalid</span>
                <span>{preview.warningRows} with warnings</span>
              </div>
              {preview.rows.length > 0 && (
                <div className="table-scroll asset-csv-preview-scroll">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th scope="col">Row</th>
                        <th scope="col">Asset tag</th>
                        <th scope="col">Name</th>
                        <th scope="col">Category</th>
                        <th scope="col">Result</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.rows.map((row) => (
                        <tr key={row.rowNumber}>
                          <td>{row.rowNumber}</td>
                          <td>{row.assetTag || '—'}</td>
                          <td>{row.name || '—'}</td>
                          <td>{row.categoryCode || '—'}</td>
                          <td>
                            {row.errors.length > 0 ? (
                              <ul className="asset-csv-issues">
                                {row.errors.map((issue, index) => (
                                  <li key={`${issue.code}-${index}`}>
                                    {issue.column}: {issue.message}
                                  </li>
                                ))}
                              </ul>
                            ) : row.warnings.length > 0 ? (
                              <ul className="asset-csv-issues">
                                {row.warnings.map((issue, index) => (
                                  <li key={`${issue.code}-${index}`}>
                                    {issue.column}: {issue.message}
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <span className="status-badge status-success">
                                Ready
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </section>
  )
}

function buildExportPath(filters: AssetCsvFilters): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) {
    if (value) params.set(key, value)
  }
  const query = params.toString()
  return query ? `assets/export.csv?${query}` : 'assets/export.csv'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isAssetCsvPreview(value: unknown): value is AssetCsvPreview {
  if (!isRecord(value)) return false
  return (
    typeof value.totalRows === 'number' &&
    typeof value.validRows === 'number' &&
    typeof value.invalidRows === 'number' &&
    typeof value.warningRows === 'number' &&
    Array.isArray(value.rows)
  )
}

function isAssetCsvImportResult(value: unknown): value is AssetCsvImportResult {
  return (
    isRecord(value) &&
    typeof value.operationId === 'string' &&
    value.mode === 'CREATE_ONLY' &&
    typeof value.totalRows === 'number' &&
    typeof value.createdRows === 'number'
  )
}

function readApiMessage(value: unknown): string | null {
  if (typeof value === 'string') return value
  if (Array.isArray(value) && value.every((item) => typeof item === 'string')) {
    return value.join(' ')
  }
  return null
}

function downloadErrorReport(preview: AssetCsvPreview): void {
  const rows = preview.rows.flatMap((row) =>
    row.errors.map((issue) => [
      String(row.rowNumber),
      row.assetTag,
      issue.column,
      issue.code,
      issue.message,
    ]),
  )
  const csv = [
    ['rowNumber', 'assetTag', 'column', 'errorCode', 'message'],
    ...rows,
  ]
    .map((row) => row.map(escapeCsvCell).join(','))
    .join('\r\n')
  const blob = new Blob([`\uFEFF${csv}\r\n`], {
    type: 'text/csv;charset=utf-8',
  })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'asset-import-errors.csv'
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function escapeCsvCell(value: string): string {
  const safeValue =
    /^[\t\r]/.test(value) || /^ *[=+\-@]/.test(value) ? `'${value}` : value
  return `"${safeValue.replace(/"/g, '""')}"`
}
