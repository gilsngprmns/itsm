import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { EmptyState, ErrorBanner } from '../common/Feedback'
import { PageHeader } from '../common/PageHeader'
import { StatusBadge } from '../common/StatusBadge'
import { ApiRequestError, apiRequest } from '../lib/api'
import './MasterDataPage.css'

type EntityKey =
  | 'asset-categories'
  | 'locations'
  | 'departments'
  | 'vendors'
  | 'ticket-categories'

interface MasterRecord {
  id: string
  code?: string
  name: string
  description?: string | null
  isActive?: boolean
  building?: string | null
  floor?: string | null
  room?: string | null
  address?: string | null
  contactPerson?: string | null
  email?: string | null
  phone?: string | null
  website?: string | null
  notes?: string | null
  memberCount?: number
  referenceCount?: number
}

interface FieldDefinition {
  key: keyof MasterRecord
  label: string
  type?: 'text' | 'email' | 'url' | 'textarea'
  maxLength: number
  required?: boolean
}

interface EntityDefinition {
  key: EntityKey
  label: string
  singular: string
  endpoint: string
  fields: FieldDefinition[]
  editFields: FieldDefinition[]
  columns: Array<{ key: keyof MasterRecord; label: string }>
  isTicketCategory?: boolean
  hasActiveState?: boolean
}

const codeField: FieldDefinition = {
  key: 'code',
  label: 'Code',
  maxLength: 50,
  required: true,
}
const nameField: FieldDefinition = {
  key: 'name',
  label: 'Name',
  maxLength: 180,
  required: true,
}
const descriptionField: FieldDefinition = {
  key: 'description',
  label: 'Description',
  maxLength: 1000,
  type: 'textarea',
}

const entities: Record<EntityKey, EntityDefinition> = {
  'asset-categories': {
    key: 'asset-categories',
    label: 'Asset categories',
    singular: 'asset category',
    endpoint: 'asset-categories',
    fields: [codeField, nameField, descriptionField],
    editFields: [nameField, descriptionField],
    columns: [
      { key: 'code', label: 'Code' },
      { key: 'name', label: 'Category' },
      { key: 'description', label: 'Description' },
    ],
    hasActiveState: true,
  },
  locations: {
    key: 'locations',
    label: 'Locations',
    singular: 'location',
    endpoint: 'locations',
    fields: [
      { ...codeField, maxLength: 30 },
      nameField,
      { key: 'building', label: 'Building', maxLength: 100 },
      { key: 'floor', label: 'Floor', maxLength: 30 },
      { key: 'room', label: 'Room', maxLength: 50 },
      { key: 'address', label: 'Address', maxLength: 500 },
    ],
    editFields: [
      nameField,
      { key: 'building', label: 'Building', maxLength: 100 },
      { key: 'floor', label: 'Floor', maxLength: 30 },
      { key: 'room', label: 'Room', maxLength: 50 },
      { key: 'address', label: 'Address', maxLength: 500 },
    ],
    columns: [
      { key: 'code', label: 'Code' },
      { key: 'name', label: 'Location' },
      { key: 'building', label: 'Building' },
      { key: 'floor', label: 'Floor' },
      { key: 'room', label: 'Room' },
    ],
    hasActiveState: true,
  },
  departments: {
    key: 'departments',
    label: 'Departments',
    singular: 'department',
    endpoint: 'departments',
    fields: [
      { ...codeField, maxLength: 30 },
      { ...nameField, maxLength: 150 },
      descriptionField,
    ],
    editFields: [{ ...nameField, maxLength: 150 }, descriptionField],
    columns: [
      { key: 'code', label: 'Code' },
      { key: 'name', label: 'Department' },
      { key: 'description', label: 'Description' },
      { key: 'memberCount', label: 'Members' },
    ],
    hasActiveState: true,
  },
  vendors: {
    key: 'vendors',
    label: 'Vendors',
    singular: 'vendor',
    endpoint: 'vendors',
    fields: [
      { ...nameField, maxLength: 180 },
      {
        key: 'contactPerson',
        label: 'Contact person',
        maxLength: 150,
      },
      { key: 'email', label: 'Email', type: 'email', maxLength: 254 },
      { key: 'phone', label: 'Phone', maxLength: 30 },
      { key: 'website', label: 'Website', type: 'url', maxLength: 500 },
      { key: 'address', label: 'Address', maxLength: 1000 },
      { key: 'notes', label: 'Notes', maxLength: 2000, type: 'textarea' },
    ],
    editFields: [
      { ...nameField, maxLength: 180 },
      {
        key: 'contactPerson',
        label: 'Contact person',
        maxLength: 150,
      },
      { key: 'email', label: 'Email', type: 'email', maxLength: 254 },
      { key: 'phone', label: 'Phone', maxLength: 30 },
      { key: 'website', label: 'Website', type: 'url', maxLength: 500 },
      { key: 'address', label: 'Address', maxLength: 1000 },
      { key: 'notes', label: 'Notes', maxLength: 2000, type: 'textarea' },
    ],
    columns: [
      { key: 'name', label: 'Vendor' },
      { key: 'contactPerson', label: 'Contact' },
      { key: 'email', label: 'Email' },
      { key: 'phone', label: 'Phone' },
      { key: 'referenceCount', label: 'References' },
    ],
  },
  'ticket-categories': {
    key: 'ticket-categories',
    label: 'Ticket categories',
    singular: 'ticket category',
    endpoint: 'ticket-categories',
    fields: [codeField, nameField, descriptionField],
    editFields: [nameField, descriptionField],
    columns: [
      { key: 'code', label: 'Code' },
      { key: 'name', label: 'Category' },
      { key: 'description', label: 'Description' },
    ],
    isTicketCategory: true,
    hasActiveState: true,
  },
}

const assetEntityKeys: EntityKey[] = [
  'asset-categories',
  'locations',
  'departments',
  'vendors',
]

function requestError(error: unknown, action: string): string {
  if (error instanceof ApiRequestError) {
    if (error.status === 401) return 'Your session expired. Sign in again.'
    if (error.status === 403)
      return 'Your account does not have permission to manage this data.'
    if (error.status === 409)
      return 'This code is already in use. Choose a different code.'
    if (error.status === 400)
      return 'Some fields are invalid. Review the form and try again.'
  }
  return `Unable to ${action}. Check your connection and try again.`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function readRecords(value: unknown): MasterRecord[] {
  if (!Array.isArray(value)) {
    throw new Error('The server returned an invalid master data list.')
  }
  return value.filter(
    (item): item is MasterRecord =>
      isRecord(item) &&
      typeof item.id === 'string' &&
      typeof item.name === 'string',
  )
}

function emptyValues(fields: FieldDefinition[]): Record<string, string> {
  return Object.fromEntries(fields.map((field) => [field.key, '']))
}

function valuesFromRecord(
  fields: FieldDefinition[],
  record: MasterRecord,
): Record<string, string> {
  return Object.fromEntries(
    fields.map((field) => [field.key, String(record[field.key] ?? '')]),
  )
}

function payloadFromValues(
  fields: FieldDefinition[],
  values: Record<string, string>,
): Record<string, string | null> {
  return Object.fromEntries(
    fields.map((field) => {
      const value = values[field.key]?.trim() ?? ''
      return [field.key, value || (field.required ? '' : null)]
    }),
  )
}

export function MasterDataPage() {
  const { user } = useAuth()
  const canReadAssets = user?.permissions.includes('assets.read') ?? false
  const canReadTickets =
    user?.permissions.includes('tickets.read.all') ||
    user?.permissions.includes('tickets.read.own') ||
    false
  const canReadUsers = user?.permissions.includes('users.read') ?? false
  const visibleAssetKeys = canReadAssets ? assetEntityKeys : []
  const visibleTicketKeys = canReadTickets ? ['ticket-categories' as const] : []
  const [selected, setSelected] = useState<EntityKey>(
    visibleAssetKeys[0] ?? visibleTicketKeys[0] ?? 'asset-categories',
  )
  const [showPeople, setShowPeople] = useState(
    !visibleAssetKeys.length && !visibleTicketKeys.length && canReadUsers,
  )
  const activeKeys = [...visibleAssetKeys, ...visibleTicketKeys]
  const selectedEntity = activeKeys.includes(selected)
    ? selected
    : (activeKeys[0] ?? 'asset-categories')

  const selectEntity = (key: EntityKey) => {
    setShowPeople(false)
    setSelected(key)
  }

  return (
    <main className="page management-page master-data-page">
      <PageHeader
        title="Master data"
        description="Manage the reference data that keeps asset and service workflows consistent."
      />
      <div className="master-data-overview">
        <div>
          <span className="master-data-overview-label">
            ASSET &amp; ORGANIZATION
          </span>
          <strong>Core records</strong>
          <span>Categories, locations, departments, and vendors</span>
        </div>
        <div>
          <span className="master-data-overview-label">SERVICE MANAGEMENT</span>
          <strong>Ticket categories</strong>
          <span>Classify support work consistently</span>
        </div>
        <Link className="master-data-csv-link" to="/assets">
          Asset CSV tools <span aria-hidden="true">↗</span>
        </Link>
      </div>

      <nav aria-label="Master data sections" className="master-data-tabs">
        {visibleAssetKeys.length > 0 && (
          <div className="master-data-tab-group">
            <span>ASSET &amp; ORGANIZATION</span>
            {visibleAssetKeys.map((key) => (
              <button
                aria-current={
                  !showPeople && selectedEntity === key ? 'page' : undefined
                }
                className={
                  !showPeople && selectedEntity === key
                    ? 'master-data-tab-active'
                    : ''
                }
                key={key}
                onClick={() => selectEntity(key)}
                type="button"
              >
                {entities[key].label}
              </button>
            ))}
          </div>
        )}
        {visibleTicketKeys.length > 0 && (
          <div className="master-data-tab-group">
            <span>SERVICE MANAGEMENT</span>
            {visibleTicketKeys.map((key) => (
              <button
                aria-current={
                  !showPeople && selectedEntity === key ? 'page' : undefined
                }
                className={
                  !showPeople && selectedEntity === key
                    ? 'master-data-tab-active'
                    : ''
                }
                key={key}
                onClick={() => selectEntity(key)}
                type="button"
              >
                {entities[key].label}
              </button>
            ))}
          </div>
        )}
        {canReadUsers && (
          <div className="master-data-tab-group">
            <span>PEOPLE</span>
            <button
              aria-current={showPeople ? 'page' : undefined}
              className={showPeople ? 'master-data-tab-active' : ''}
              onClick={() => setShowPeople(true)}
              type="button"
            >
              IT team
            </button>
          </div>
        )}
      </nav>

      {showPeople ? (
        <section className="master-data-people">
          <div>
            <span className="master-data-overview-label">USER DIRECTORY</span>
            <h2>IT team and employees</h2>
            <p>
              Manage employee profiles, support roles, and account status in the
              existing user administration area.
            </p>
            <Link className="button-link button-primary" to="/users">
              Open user management
            </Link>
          </div>
          <div aria-hidden="true" className="master-data-people-art">
            <span>IT</span>
            <i />
            <i />
            <i />
          </div>
        </section>
      ) : activeKeys.length > 0 ? (
        <MasterDataSection
          canManage={
            selectedEntity === 'ticket-categories'
              ? (user?.permissions.includes('tickets.update') ?? false)
              : (user?.permissions.includes('assets.update') ?? false)
          }
          definition={entities[selectedEntity]}
          key={selectedEntity}
        />
      ) : (
        <EmptyState message="Your account does not have access to master data." />
      )}
    </main>
  )
}

function MasterDataSection({
  definition,
  canManage,
}: {
  definition: EntityDefinition
  canManage: boolean
}) {
  const [records, setRecords] = useState<MasterRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<MasterRecord | null>(null)
  const [values, setValues] = useState<Record<string, string>>({})
  const [search, setSearch] = useState('')
  const [activeFilter, setActiveFilter] = useState('all')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const loadRecords = useCallback(async () => {
    setLoading(true)
    try {
      const path =
        definition.isTicketCategory && canManage
          ? `${definition.endpoint}?includeInactive=true`
          : definition.endpoint
      setRecords(readRecords(await apiRequest<unknown>(path)))
      setError(null)
    } catch (cause) {
      setError(requestError(cause, 'load master data'))
    } finally {
      setLoading(false)
    }
  }, [canManage, definition])

  useEffect(() => {
    let active = true
    queueMicrotask(() => {
      if (active) void loadRecords()
    })
    return () => {
      active = false
    }
  }, [loadRecords])

  const startCreate = () => {
    setEditing(null)
    setValues(emptyValues(definition.fields))
    setShowForm(true)
    setError(null)
    setNotice(null)
  }

  const startEdit = (record: MasterRecord) => {
    setEditing(record)
    setValues(valuesFromRecord(definition.editFields, record))
    setShowForm(true)
    setError(null)
    setNotice(null)
  }

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    setError(null)
    setNotice(null)
    const fields = editing ? definition.editFields : definition.fields
    try {
      await apiRequest<unknown>(
        editing ? `${definition.endpoint}/${editing.id}` : definition.endpoint,
        {
          method: editing ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payloadFromValues(fields, values)),
        },
      )
      setShowForm(false)
      setNotice(`${definition.singular} ${editing ? 'updated' : 'created'}.`)
      await loadRecords()
    } catch (cause) {
      setError(requestError(cause, `save ${definition.singular}`))
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (record: MasterRecord) => {
    if (typeof record.isActive !== 'boolean') return
    const action = record.isActive ? 'deactivate' : 'activate'
    if (
      !window.confirm(
        `${action === 'deactivate' ? 'Deactivate' : 'Activate'} ${definition.singular} "${record.name}"? Existing references will be kept.`,
      )
    ) {
      return
    }
    setSaving(true)
    setError(null)
    setNotice(null)
    try {
      const endpoint = definition.isTicketCategory
        ? `${definition.endpoint}/${record.id}/status`
        : `${definition.endpoint}/${record.id}`
      await apiRequest<unknown>(endpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !record.isActive }),
      })
      setNotice(
        `${definition.singular} ${action === 'deactivate' ? 'deactivated' : 'activated'}. Existing references are unchanged.`,
      )
      await loadRecords()
    } catch (cause) {
      setError(requestError(cause, `${action} ${definition.singular}`))
    } finally {
      setSaving(false)
    }
  }

  const visibleRecords = records.filter((record) => {
    const matchesSearch = [
      record.code,
      record.name,
      record.description,
      record.building,
      record.email,
      record.contactPerson,
    ]
      .filter(Boolean)
      .join(' ')
      .toLocaleLowerCase()
      .includes(search.trim().toLocaleLowerCase())
    const matchesActive =
      activeFilter === 'all' ||
      (activeFilter === 'active' && record.isActive !== false) ||
      (activeFilter === 'inactive' && record.isActive === false)
    return matchesSearch && matchesActive
  })
  const editFields = editing ? definition.editFields : definition.fields

  return (
    <section
      aria-labelledby="master-data-list-heading"
      className="master-data-section"
    >
      <div className="master-data-section-heading">
        <div>
          <span className="master-data-overview-label">
            {definition.isTicketCategory
              ? 'TICKET MASTER'
              : definition.key === 'vendors' || definition.key === 'departments'
                ? 'ORGANIZATION MASTER'
                : 'ASSET MASTER'}
          </span>
          <h2 id="master-data-list-heading">{definition.label}</h2>
          <p>
            {definition.key === 'vendors'
              ? 'Vendor records are retained because assets and maintenance may reference them.'
              : 'Reference records are never deleted; deactivation preserves existing relationships.'}
          </p>
        </div>
        {canManage && (
          <button
            className="button-primary"
            onClick={startCreate}
            type="button"
          >
            Add {definition.singular}
          </button>
        )}
      </div>

      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
      {error && <ErrorBanner>{error}</ErrorBanner>}

      {showForm && canManage && (
        <section
          aria-labelledby="master-data-form-heading"
          className="form-panel"
        >
          <div className="master-data-form-heading">
            <h3 id="master-data-form-heading">
              {editing
                ? `Edit ${definition.singular}`
                : `Add ${definition.singular}`}
            </h3>
            <button
              className="text-button"
              disabled={saving}
              onClick={() => setShowForm(false)}
              type="button"
            >
              Cancel
            </button>
          </div>
          <form className="form-grid master-data-form" onSubmit={save}>
            {editFields.map((field) => (
              <label
                className={field.type === 'textarea' ? 'field-wide' : undefined}
                key={field.key}
              >
                {field.label}
                {field.type === 'textarea' ? (
                  <textarea
                    maxLength={field.maxLength}
                    onChange={(event) =>
                      setValues((current) => ({
                        ...current,
                        [field.key]: event.target.value,
                      }))
                    }
                    required={field.required}
                    value={values[field.key] ?? ''}
                  />
                ) : (
                  <input
                    maxLength={field.maxLength}
                    onChange={(event) =>
                      setValues((current) => ({
                        ...current,
                        [field.key]: event.target.value,
                      }))
                    }
                    required={field.required}
                    type={field.type ?? 'text'}
                    value={values[field.key] ?? ''}
                  />
                )}
              </label>
            ))}
            <div className="master-data-form-actions">
              <button
                className="button-primary"
                disabled={saving}
                type="submit"
              >
                {saving
                  ? 'Saving…'
                  : editing
                    ? 'Save changes'
                    : 'Create record'}
              </button>
            </div>
          </form>
        </section>
      )}

      <div className="master-data-toolbar">
        <label>
          Search {definition.label.toLocaleLowerCase()}
          <input
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name, code, or details"
            type="search"
            value={search}
          />
        </label>
        {definition.hasActiveState && (
          <label>
            Status
            <select
              onChange={(event) => setActiveFilter(event.target.value)}
              value={activeFilter}
            >
              <option value="all">All records</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </label>
        )}
        <span>{visibleRecords.length} records</span>
      </div>

      {loading ? (
        <p role="status">Loading {definition.label.toLocaleLowerCase()}…</p>
      ) : visibleRecords.length === 0 ? (
        <EmptyState
          message={
            records.length
              ? 'No records match your search or status filter.'
              : `No ${definition.label.toLocaleLowerCase()} have been added yet.`
          }
          action={
            canManage && records.length === 0 ? (
              <button onClick={startCreate} type="button">
                Add {definition.singular}
              </button>
            ) : undefined
          }
        />
      ) : (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                {definition.columns.map((column) => (
                  <th key={column.key} scope="col">
                    {column.label}
                  </th>
                ))}
                {definition.hasActiveState && <th scope="col">Status</th>}
                {canManage && <th scope="col">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {visibleRecords.map((record) => (
                <tr key={record.id}>
                  {definition.columns.map((column) => (
                    <td key={column.key}>{formatCell(record[column.key])}</td>
                  ))}
                  {definition.hasActiveState && (
                    <td>
                      <StatusBadge
                        value={record.isActive ? 'ACTIVE' : 'INACTIVE'}
                      />
                    </td>
                  )}
                  {canManage && (
                    <td className="master-data-actions">
                      <button
                        disabled={saving}
                        onClick={() => startEdit(record)}
                        type="button"
                      >
                        Edit
                      </button>
                      {definition.hasActiveState && (
                        <button
                          disabled={saving}
                          onClick={() => void toggleActive(record)}
                          type="button"
                        >
                          {record.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function formatCell(value: unknown): string {
  if (typeof value === 'number') return value.toLocaleString()
  if (typeof value === 'string' && value.trim()) return value
  return '—'
}
