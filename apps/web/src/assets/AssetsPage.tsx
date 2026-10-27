import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { EmptyState } from '../common/Feedback'
import { PageHeader } from '../common/PageHeader'
import { StatusBadge, statusLabel } from '../common/StatusBadge'
import { ApiRequestError, apiRequest, buildApiUrl } from '../lib/api'
import { AssetCsvTools } from './AssetCsvTools'

interface Asset {
  id: string
  assetCode: string
  assetTag: string
  name: string
  category: { id: string; code: string; name: string }
  status: string
  location: { id: string; code: string; name: string } | null
  assignedUser?: { id: string; fullName: string } | null
  isShared: boolean
}

interface Category {
  id: string
  code: string
  name: string
  isActive: boolean
}

interface Location {
  id: string
  code: string
  name: string
  isActive: boolean
}

interface AssetPageResult {
  items: Asset[]
  page: number
  limit: number
  total: number
}

interface AssetForm {
  assetTag: string
  name: string
  categoryId: string
  manufacturer: string
  model: string
  serialNumber: string
  locationId: string
  purchaseDate: string
  warrantyEnd: string
  notes: string
}

const emptyAsset: AssetForm = {
  assetTag: '',
  name: '',
  categoryId: '',
  manufacturer: '',
  model: '',
  serialNumber: '',
  locationId: '',
  purchaseDate: '',
  warrantyEnd: '',
  notes: '',
}

function apiErrorMessage(error: unknown): string {
  if (!(error instanceof ApiRequestError)) {
    return 'Unable to complete the request. Please try again.'
  }
  if (error.status === 401) return 'Your session expired. Sign in again.'
  if (error.status === 403) return 'You do not have permission to do this.'
  if (error.status === 404) return 'The requested asset was not found.'
  if (error.status === 409)
    return 'The asset tag or serial number is already in use, or this action conflicts with its current state.'
  if (error.status === 400)
    return 'Review the selected filters and form fields.'
  return 'The API could not complete the request. Please try again.'
}

export function AssetsPage() {
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const [items, setItems] = useState<Asset[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState(() => searchParams.get('status') ?? '')
  const [categoryId, setCategoryId] = useState('')
  const [locationId, setLocationId] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [selectedLabels, setSelectedLabels] = useState<string[]>([])
  const [selectedAssetRecords, setSelectedAssetRecords] = useState<
    Record<string, Asset>
  >({})
  const [printingLabels, setPrintingLabels] = useState(false)
  const [form, setForm] = useState<AssetForm>(emptyAsset)
  const canCreate = user?.permissions.includes('assets.create') ?? false
  const pageCount = Math.max(1, Math.ceil(total / 25))

  const loadAssets = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page), limit: '25' })
    if (search) params.set('search', search)
    if (status) params.set('status', status)
    if (categoryId) params.set('categoryId', categoryId)
    if (locationId) params.set('locationId', locationId)
    try {
      const [result, categoryResult, locationResult] = await Promise.all([
        apiRequest<AssetPageResult>(`assets?${params}`),
        apiRequest<Category[]>('asset-categories'),
        apiRequest<Location[]>('locations'),
      ])
      setItems(result.items)
      setTotal(result.total)
      setCategories(categoryResult)
      setLocations(locationResult)
      setError(null)
    } catch (cause) {
      setError(apiErrorMessage(cause))
    } finally {
      setLoading(false)
    }
  }, [page, search, status, categoryId, locationId])

  useEffect(() => {
    let active = true
    queueMicrotask(() => {
      if (active) void loadAssets()
    })
    return () => {
      active = false
    }
  }, [loadAssets])

  const searchAssets = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoading(true)
    setPage(1)
    setSearch(searchInput.trim())
  }

  const createAsset = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    setError(null)
    setNotice(null)
    try {
      await apiRequest<Asset>('assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assetTag: form.assetTag,
          name: form.name,
          categoryId: form.categoryId,
          manufacturer: form.manufacturer || undefined,
          model: form.model || undefined,
          serialNumber: form.serialNumber || undefined,
          locationId: form.locationId || undefined,
          purchaseDate: form.purchaseDate || undefined,
          warrantyEnd: form.warrantyEnd || undefined,
          notes: form.notes || undefined,
        }),
      })
      setForm(emptyAsset)
      setShowCreate(false)
      setNotice('Asset created and set to AVAILABLE.')
      setPage(1)
      await loadAssets()
    } catch (cause) {
      setError(apiErrorMessage(cause))
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="page management-page">
      {printingLabels ? (
        <section className="asset-label-sheet">
          <button
            className="no-print"
            onClick={() => setPrintingLabels(false)}
            type="button"
          >
            Back
          </button>
          <button
            className="no-print"
            onClick={() => window.print()}
            type="button"
          >
            Print labels
          </button>
          <div className="asset-label-grid">
            {selectedLabels
              .map((id) => selectedAssetRecords[id])
              .filter((asset): asset is Asset => Boolean(asset))
              .map((asset) => (
                <article className="asset-label" key={asset.id}>
                  <img
                    alt={`QR code for ${asset.assetCode}`}
                    src={buildApiUrl(`assets/${asset.id}/qr`)}
                  />
                  <div>
                    <strong>{asset.assetCode}</strong>
                    <p>{asset.name}</p>
                    <small>{asset.assetTag}</small>
                  </div>
                </article>
              ))}
          </div>
        </section>
      ) : (
        <>
          <PageHeader
            title="Assets"
            actions={
              canCreate ? (
                <button
                  type="button"
                  onClick={() => {
                    setShowCreate((current) => !current)
                    setError(null)
                  }}
                >
                  {showCreate ? 'Cancel' : 'Create asset'}
                </button>
              ) : undefined
            }
          />
          <AssetCsvTools
            filters={{ search, status, categoryId, locationId }}
            onImported={() => {
              setLoading(true)
              void loadAssets()
            }}
          />

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

          {showCreate && canCreate && (
            <form
              className="form-panel"
              onSubmit={(event) => void createAsset(event)}
            >
              <h2>New asset</h2>
              <div className="form-grid">
                <label>
                  Asset tag
                  <input
                    maxLength={100}
                    onChange={(event) =>
                      setForm({ ...form, assetTag: event.target.value })
                    }
                    required
                    value={form.assetTag}
                  />
                </label>
                <label>
                  Name
                  <input
                    maxLength={200}
                    onChange={(event) =>
                      setForm({ ...form, name: event.target.value })
                    }
                    required
                    value={form.name}
                  />
                </label>
                <label>
                  Category
                  <select
                    onChange={(event) =>
                      setForm({ ...form, categoryId: event.target.value })
                    }
                    required
                    value={form.categoryId}
                  >
                    <option value="">Select category</option>
                    {categories
                      .filter((category) => category.isActive)
                      .map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  Location
                  <select
                    onChange={(event) =>
                      setForm({ ...form, locationId: event.target.value })
                    }
                    value={form.locationId}
                  >
                    <option value="">No location</option>
                    {locations
                      .filter((location) => location.isActive)
                      .map((location) => (
                        <option key={location.id} value={location.id}>
                          {location.name}
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  Manufacturer
                  <input
                    maxLength={150}
                    onChange={(event) =>
                      setForm({ ...form, manufacturer: event.target.value })
                    }
                    value={form.manufacturer}
                  />
                </label>
                <label>
                  Model
                  <input
                    maxLength={150}
                    onChange={(event) =>
                      setForm({ ...form, model: event.target.value })
                    }
                    value={form.model}
                  />
                </label>
                <label>
                  Serial number
                  <input
                    maxLength={150}
                    onChange={(event) =>
                      setForm({ ...form, serialNumber: event.target.value })
                    }
                    value={form.serialNumber}
                  />
                </label>
                <label>
                  Purchase date
                  <input
                    onChange={(event) =>
                      setForm({ ...form, purchaseDate: event.target.value })
                    }
                    type="date"
                    value={form.purchaseDate}
                  />
                </label>
                <label>
                  Warranty ends
                  <input
                    onChange={(event) =>
                      setForm({ ...form, warrantyEnd: event.target.value })
                    }
                    type="date"
                    value={form.warrantyEnd}
                  />
                </label>
                <label className="field-wide">
                  Notes
                  <textarea
                    maxLength={2000}
                    onChange={(event) =>
                      setForm({ ...form, notes: event.target.value })
                    }
                    value={form.notes}
                  />
                </label>
              </div>
              <button disabled={saving} type="submit">
                {saving ? 'Saving…' : 'Create asset'}
              </button>
            </form>
          )}

          <form className="filter-form" onSubmit={searchAssets}>
            <label>
              Search
              <input
                maxLength={100}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Asset tag, name, or serial number"
                value={searchInput}
              />
            </label>
            <label>
              Status
              <select
                onChange={(event) => {
                  setLoading(true)
                  setPage(1)
                  setStatus(event.target.value)
                }}
                value={status}
              >
                <option value="">All statuses</option>
                {[
                  'AVAILABLE',
                  'ASSIGNED',
                  'IN_REPAIR',
                  'DAMAGED',
                  'LOST',
                  'RETIRED',
                  'DISPOSED',
                ].map((value) => (
                  <option key={value} value={value}>
                    {statusLabel(value)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Category
              <select
                onChange={(event) => {
                  setLoading(true)
                  setPage(1)
                  setCategoryId(event.target.value)
                }}
                value={categoryId}
              >
                <option value="">All categories</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                    {category.isActive ? '' : ' (inactive)'}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Location
              <select
                onChange={(event) => {
                  setLoading(true)
                  setPage(1)
                  setLocationId(event.target.value)
                }}
                value={locationId}
              >
                <option value="">All locations</option>
                {locations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name}
                    {location.isActive ? '' : ' (inactive)'}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit">Search</button>
          </form>

          {loading ? (
            <p role="status">Loading assets…</p>
          ) : items.length === 0 ? (
            <EmptyState
              message="No assets found for these filters."
              action={
                canCreate ? (
                  <button
                    className="text-button"
                    onClick={() => setShowCreate(true)}
                    type="button"
                  >
                    Create asset
                  </button>
                ) : undefined
              }
            />
          ) : (
            <>
              <div className="toolbar-row">
                <span>
                  {selectedLabels.length} labels selected (maximum 50)
                </span>
                <button
                  disabled={
                    !selectedLabels.length || selectedLabels.length > 50
                  }
                  onClick={() => setPrintingLabels(true)}
                  type="button"
                >
                  Print labels
                </button>
              </div>
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th scope="col">Select</th>
                      <th scope="col">Asset tag</th>
                      <th scope="col">Asset code</th>
                      <th scope="col">Name</th>
                      <th scope="col">Category</th>
                      <th scope="col">Status</th>
                      <th scope="col">Location</th>
                      <th scope="col">Assigned to</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((asset) => (
                      <tr key={asset.id}>
                        <td>
                          <input
                            aria-label={`Select ${asset.assetCode} label`}
                            checked={selectedLabels.includes(asset.id)}
                            disabled={
                              !selectedLabels.includes(asset.id) &&
                              selectedLabels.length >= 50
                            }
                            onChange={(event) => {
                              const checked = event.target.checked
                              setSelectedLabels((current) =>
                                checked
                                  ? [...current, asset.id]
                                  : current.filter((id) => id !== asset.id),
                              )
                              setSelectedAssetRecords((current) => {
                                const next = { ...current }
                                if (checked) next[asset.id] = asset
                                else delete next[asset.id]
                                return next
                              })
                            }}
                            type="checkbox"
                          />
                        </td>
                        <td>
                          <Link to={`/assets/${asset.id}`}>
                            {asset.assetTag}
                          </Link>
                        </td>
                        <td>{asset.assetCode}</td>
                        <td>{asset.name}</td>
                        <td>{asset.category.name}</td>
                        <td>
                          <StatusBadge value={asset.status} />
                        </td>
                        <td>{asset.location?.name ?? 'No location'}</td>
                        <td>{asset.assignedUser?.fullName ?? 'Unassigned'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <nav aria-label="Asset pages" className="pagination">
                <button
                  disabled={page <= 1}
                  type="button"
                  onClick={() => {
                    setLoading(true)
                    setPage((current) => current - 1)
                  }}
                >
                  Previous page
                </button>
                <span>
                  Showing {(page - 1) * 25 + 1} to {Math.min(page * 25, total)}{' '}
                  of {total} assets
                </span>
                <button
                  disabled={page >= pageCount}
                  type="button"
                  onClick={() => {
                    setLoading(true)
                    setPage((current) => current + 1)
                  }}
                >
                  Next page
                </button>
              </nav>
            </>
          )}
        </>
      )}
    </main>
  )
}
