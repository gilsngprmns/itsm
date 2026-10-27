import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../auth/AuthContext'
import { EmptyState } from '../common/Feedback'
import { formatDate, formatDateTimeFull } from '../common/format'
import { PageHeader } from '../common/PageHeader'
import { StatusBadge } from '../common/StatusBadge'
import { ApiRequestError, apiRequest } from '../lib/api'

interface UserRecord {
  id: string
  employeeCode: string | null
  fullName: string
  email?: string
  phone?: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
  roles: string[]
}

interface UserPageResult {
  items: UserRecord[]
  page: number
  limit: number
  total: number
}

interface UserFormState {
  fullName: string
  email: string
  initialPassword: string
  employeeCode: string
  phone: string
}

const emptyForm: UserFormState = {
  fullName: '',
  email: '',
  initialPassword: '',
  employeeCode: '',
  phone: '',
}

function errorMessage(error: unknown): string {
  if (!(error instanceof ApiRequestError)) {
    return 'Unable to complete the request. Please try again.'
  }
  if (error.status === 401) return 'Your session expired. Sign in again.'
  if (error.status === 403) return 'You do not have permission to do this.'
  if (error.status === 409)
    return 'This email or employee code is already in use.'
  if (error.status === 400) return 'Review the form fields and try again.'
  return 'The API could not complete the request. Please try again.'
}

export function UsersPage() {
  const { user } = useAuth()
  const [items, setItems] = useState<UserRecord[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [createForm, setCreateForm] = useState<UserFormState>(emptyForm)
  const [editing, setEditing] = useState<UserRecord | null>(null)
  const [saving, setSaving] = useState(false)

  const canCreate = user?.permissions.includes('users.create') ?? false
  const canUpdate = user?.permissions.includes('users.update') ?? false
  const canChangeRole = user?.permissions.includes('roles.manage') ?? false
  const canChangeStatus =
    user?.permissions.includes('users.deactivate') ?? false

  const loadUsers = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page), limit: '25' })
    if (search) params.set('search', search)
    try {
      const result = await apiRequest<UserPageResult>(`users?${params}`)
      setItems(result.items)
      setTotal(result.total)
      setError(null)
    } catch (cause) {
      setError(errorMessage(cause))
    } finally {
      setLoading(false)
    }
  }, [page, search])

  useEffect(() => {
    let active = true
    queueMicrotask(() => {
      if (active) void loadUsers()
    })
    return () => {
      active = false
    }
  }, [loadUsers])

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoading(true)
    setPage(1)
    setSearch(searchInput.trim())
  }

  const createUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    setError(null)
    setNotice(null)
    try {
      await apiRequest<UserRecord>('users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: createForm.fullName,
          email: createForm.email,
          initialPassword: createForm.initialPassword,
          employeeCode: createForm.employeeCode || undefined,
          phone: createForm.phone || undefined,
        }),
      })
      setCreateForm(emptyForm)
      setShowCreate(false)
      setNotice(
        'User created. Share the initial password through a secure channel.',
      )
      setPage(1)
      setSearch('')
      setSearchInput('')
      await loadUsers()
    } catch (cause) {
      setError(errorMessage(cause))
    } finally {
      setSaving(false)
    }
  }

  const saveUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!editing) return
    setSaving(true)
    setError(null)
    setNotice(null)
    try {
      await apiRequest<UserRecord>(`users/${editing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: editing.fullName,
          email: editing.email,
          employeeCode: editing.employeeCode,
          phone: editing.phone,
        }),
      })
      setEditing(null)
      setNotice('User details updated.')
      await loadUsers()
    } catch (cause) {
      setError(errorMessage(cause))
    } finally {
      setSaving(false)
    }
  }

  const changeStatus = async (record: UserRecord) => {
    const nextActive = !record.isActive
    const prompt = nextActive
      ? `Reactivate ${record.fullName}?`
      : `Deactivate ${record.fullName}? This will end all active sessions.`
    if (!window.confirm(prompt)) return
    setError(null)
    setNotice(null)
    try {
      await apiRequest<UserRecord>(`users/${record.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: nextActive }),
      })
      setNotice(
        nextActive ? 'User activated.' : 'User deactivated; sessions revoked.',
      )
      await loadUsers()
    } catch (cause) {
      setError(errorMessage(cause))
    }
  }

  const changeRole = async (record: UserRecord, roleCode: string) => {
    if (!roleCode || record.id === user?.id) return
    if (
      !window.confirm(
        `Replace ${record.fullName}'s role assignments with ${roleCode}?`,
      )
    ) {
      return
    }
    setError(null)
    setNotice(null)
    try {
      await apiRequest<UserRecord>(`users/${record.id}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roleCode }),
      })
      setNotice(`Role updated to ${roleCode}.`)
      await loadUsers()
    } catch (cause) {
      setError(errorMessage(cause))
    }
  }

  const pageCount = Math.max(1, Math.ceil(total / 25))

  return (
    <main className="page management-page">
      <PageHeader
        title="Users"
        actions={
          canCreate ? (
            <button
              type="button"
              onClick={() => {
                setShowCreate((current) => !current)
                setEditing(null)
                setError(null)
              }}
            >
              {showCreate ? 'Cancel' : 'Create user'}
            </button>
          ) : undefined
        }
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
          onSubmit={(event) => void createUser(event)}
        >
          <h2>Create user</h2>
          <p className="form-help">
            The initial password is stored only as a hash. Deliver it to the
            user using a separate secure channel; password reset is not
            available yet.
          </p>
          <div className="form-grid">
            <label>
              Full name
              <input
                autoComplete="name"
                maxLength={200}
                onChange={(event) =>
                  setCreateForm({ ...createForm, fullName: event.target.value })
                }
                required
                value={createForm.fullName}
              />
            </label>
            <label>
              Email
              <input
                autoComplete="email"
                maxLength={254}
                onChange={(event) =>
                  setCreateForm({ ...createForm, email: event.target.value })
                }
                required
                type="email"
                value={createForm.email}
              />
            </label>
            <label>
              Initial password
              <input
                autoComplete="new-password"
                maxLength={128}
                minLength={12}
                onChange={(event) =>
                  setCreateForm({
                    ...createForm,
                    initialPassword: event.target.value,
                  })
                }
                required
                type="password"
                value={createForm.initialPassword}
              />
            </label>
            <label>
              Employee code
              <input
                maxLength={50}
                onChange={(event) =>
                  setCreateForm({
                    ...createForm,
                    employeeCode: event.target.value,
                  })
                }
                value={createForm.employeeCode}
              />
            </label>
            <label>
              Phone
              <input
                maxLength={30}
                onChange={(event) =>
                  setCreateForm({ ...createForm, phone: event.target.value })
                }
                value={createForm.phone}
              />
            </label>
          </div>
          <button disabled={saving} type="submit">
            {saving ? 'Creating user…' : 'Create user'}
          </button>
        </form>
      )}

      {editing && canUpdate && (
        <form className="form-panel" onSubmit={(event) => void saveUser(event)}>
          <h2>Edit {editing.fullName}</h2>
          <div className="form-grid">
            <label>
              Full name
              <input
                maxLength={200}
                onChange={(event) =>
                  setEditing({ ...editing, fullName: event.target.value })
                }
                required
                value={editing.fullName}
              />
            </label>
            <label>
              Email
              <input
                maxLength={254}
                onChange={(event) =>
                  setEditing({ ...editing, email: event.target.value })
                }
                required
                type="email"
                value={editing.email ?? ''}
              />
            </label>
            <label>
              Employee code
              <input
                maxLength={50}
                onChange={(event) =>
                  setEditing({ ...editing, employeeCode: event.target.value })
                }
                value={editing.employeeCode ?? ''}
              />
            </label>
            <label>
              Phone
              <input
                maxLength={30}
                onChange={(event) =>
                  setEditing({ ...editing, phone: event.target.value })
                }
                value={editing.phone ?? ''}
              />
            </label>
          </div>
          <button disabled={saving} type="submit">
            {saving ? 'Saving…' : 'Save changes'}
          </button>
          <button type="button" onClick={() => setEditing(null)}>
            Cancel
          </button>
        </form>
      )}

      <form className="search-form" onSubmit={submitSearch}>
        <label htmlFor="user-search">Search users</label>
        <input
          id="user-search"
          maxLength={100}
          onChange={(event) => setSearchInput(event.target.value)}
          placeholder="Name or employee code"
          value={searchInput}
        />
        <button type="submit">Search</button>
      </form>

      {loading ? (
        <p role="status">Loading users…</p>
      ) : items.length === 0 ? (
        <EmptyState
          message="No users found."
          action={
            canCreate ? (
              <button
                className="text-button"
                onClick={() => setShowCreate(true)}
                type="button"
              >
                Create user
              </button>
            ) : undefined
          }
        />
      ) : (
        <>
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Email</th>
                  <th scope="col">Employee code</th>
                  <th scope="col">Role</th>
                  <th scope="col">Status</th>
                  <th scope="col">Created</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((record) => (
                  <tr key={record.id}>
                    <td>{record.fullName}</td>
                    <td>{record.email ?? 'Not provided'}</td>
                    <td>{record.employeeCode ?? 'Not provided'}</td>
                    <td>
                      {canChangeRole && record.id !== user?.id ? (
                        <select
                          aria-label={`Role for ${record.fullName}`}
                          onChange={(event) =>
                            void changeRole(record, event.target.value)
                          }
                          value={record.roles[0] ?? ''}
                        >
                          <option value="" disabled>
                            No role
                          </option>
                          {['ADMIN', 'USER', 'AUDIT', 'IT_SUPPORT'].map(
                            (roleCode) => (
                              <option key={roleCode} value={roleCode}>
                                {roleCode}
                              </option>
                            ),
                          )}
                        </select>
                      ) : (
                        record.roles.join(', ') || 'No role'
                      )}
                    </td>
                    <td>
                      <StatusBadge
                        value={record.isActive ? 'ACTIVE' : 'INACTIVE'}
                      />
                    </td>
                    <td>
                      <time
                        dateTime={record.createdAt}
                        title={formatDateTimeFull(record.createdAt)}
                      >
                        {formatDate(record.createdAt)}
                      </time>
                    </td>
                    <td className="action-cell">
                      {canUpdate && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditing(record)
                            setShowCreate(false)
                            setError(null)
                          }}
                        >
                          Edit
                        </button>
                      )}
                      {canChangeStatus && record.id !== user?.id && (
                        <button
                          type="button"
                          onClick={() => void changeStatus(record)}
                        >
                          {record.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <nav aria-label="User pages" className="pagination">
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
              Showing {(page - 1) * 25 + 1} to {Math.min(page * 25, total)} of{' '}
              {total} users
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
    </main>
  )
}
