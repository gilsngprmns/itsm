import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../auth/AuthContext'
import { apiRequest } from '../lib/api'
import { ticketErrorMessage } from './ticket-errors'
import type { TicketCategory } from './ticket-types'

export function TicketCategoriesPage() {
  const { user } = useAuth()
  const canManage = user?.permissions.includes('tickets.update') ?? false
  const [categories, setCategories] = useState<TicketCategory[]>([])
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const loadCategories = useCallback(async () => {
    try {
      const result = await apiRequest<TicketCategory[]>(
        'ticket-categories?includeInactive=true',
      )
      setCategories(result)
      setError(null)
    } catch (cause) {
      setError(ticketErrorMessage(cause, 'load categories'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let active = true
    queueMicrotask(() => {
      if (active) void loadCategories()
    })
    return () => {
      active = false
    }
  }, [loadCategories])

  const createCategory = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    setError(null)
    setNotice(null)
    try {
      await apiRequest<TicketCategory>('ticket-categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          name,
          description: description || undefined,
        }),
      })
      setCode('')
      setName('')
      setDescription('')
      setNotice('Ticket category created.')
      setLoading(true)
      await loadCategories()
    } catch (cause) {
      setError(ticketErrorMessage(cause, 'create category'))
    } finally {
      setSaving(false)
    }
  }

  const updateCategory = async (
    category: TicketCategory,
    form: HTMLFormElement,
  ) => {
    const formData = new FormData(form)
    setSaving(true)
    setError(null)
    setNotice(null)
    try {
      await apiRequest<TicketCategory>(`ticket-categories/${category.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: String(formData.get('name') ?? ''),
          description: String(formData.get('description') ?? ''),
        }),
      })
      setNotice('Ticket category updated.')
      setLoading(true)
      await loadCategories()
    } catch (cause) {
      setError(ticketErrorMessage(cause, 'update category'))
    } finally {
      setSaving(false)
    }
  }

  const setCategoryStatus = async (category: TicketCategory) => {
    setSaving(true)
    setError(null)
    setNotice(null)
    try {
      await apiRequest<TicketCategory>(
        `ticket-categories/${category.id}/status`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isActive: !category.isActive }),
        },
      )
      setNotice(
        category.isActive ? 'Category deactivated.' : 'Category activated.',
      )
      setLoading(true)
      await loadCategories()
    } catch (cause) {
      setError(ticketErrorMessage(cause, 'change category status'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="page management-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Service desk</p>
          <h1>Ticket categories</h1>
          <p className="intro">
            Manage categories used when users submit tickets.
          </p>
        </div>
      </header>
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

      {canManage && (
        <section className="form-panel" aria-labelledby="new-category-heading">
          <h2 id="new-category-heading">Add category</h2>
          <form className="form-grid" onSubmit={createCategory}>
            <label>
              Code
              <input
                required
                maxLength={50}
                value={code}
                onChange={(event) => setCode(event.target.value)}
              />
            </label>
            <label>
              Name
              <input
                required
                maxLength={100}
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
            <label className="field-wide">
              Description (optional)
              <input
                maxLength={1000}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </label>
            <div>
              <button disabled={saving} type="submit">
                Add category
              </button>
            </div>
          </form>
        </section>
      )}

      {loading ? (
        <p role="status">Loading categories…</p>
      ) : categories.length === 0 ? (
        <p className="empty-state">No ticket categories found.</p>
      ) : (
        <div className="category-list">
          {categories.map((category) => (
            <section className="form-panel category-row" key={category.id}>
              <div className="category-heading">
                <h2>{category.name}</h2>
                <span className="status-pill">
                  {category.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
              <p>
                <strong>{category.code}</strong>
                {category.description ? ` — ${category.description}` : ''}
              </p>
              {canManage && (
                <form
                  className="form-grid"
                  onSubmit={(event) => {
                    event.preventDefault()
                    void updateCategory(category, event.currentTarget)
                  }}
                >
                  <label>
                    Name
                    <input
                      name="name"
                      required
                      maxLength={100}
                      defaultValue={category.name}
                    />
                  </label>
                  <label>
                    Description
                    <input
                      name="description"
                      maxLength={1000}
                      defaultValue={category.description ?? ''}
                    />
                  </label>
                  <div className="category-actions">
                    <button disabled={saving} type="submit">
                      Save
                    </button>
                    <button
                      disabled={saving}
                      type="button"
                      onClick={() => void setCategoryStatus(category)}
                    >
                      {category.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                  </div>
                </form>
              )}
            </section>
          ))}
        </div>
      )}
    </main>
  )
}
