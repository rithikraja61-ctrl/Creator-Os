import { useState, useEffect } from 'react'
import { useRecords, useRecordCreate, useRecordUpdate } from 'lemma-sdk/react'
import { lemmaClient } from '../lemma-client'
import { Columns3, Plus, X, ArrowRight, CheckCircle, Clock, Calendar, Send, Eye } from 'lucide-react'
import { notifyTableChanged, onTableChange } from '../lib/refresh-bus'

const STATUSES = ['draft', 'review', 'approved', 'scheduled', 'published'] as const
type Status = typeof STATUSES[number]

const STATUS_CONFIG: Record<Status, { label: string; color: string }> = {
  draft: { label: 'Draft', color: 'var(--amber)' },
  review: { label: 'Review', color: 'var(--purple)' },
  approved: { label: 'Approved', color: 'var(--green)' },
  scheduled: { label: 'Scheduled', color: 'var(--blue)' },
  published: { label: 'Published', color: 'var(--green)' },
}

const CONTENT_TYPE_OPTIONS = [
  'linkedin_post', 'twitter_thread', 'blog_post', 
  'youtube_script', 'newsletter'
] as const

export function ContentQueue() {
  const podId = lemmaClient.podId
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ title: '', content_type: 'linkedin_post', body: '', idea_id: '' })
  const [selectedItem, setSelectedItem] = useState<any | null>(null)

  const { records: items, isLoading, refresh } = useRecords({
    client: lemmaClient, podId, tableName: 'content_items', limit: 200,
    sort: [{ field: 'updated_at', direction: 'desc' }]
  })

  // Auto-refresh when content items change
  useEffect(() => {
    const unsub = onTableChange('content_items', () => refresh())
    return unsub
  }, [refresh])

  const updateItem = useRecordUpdate(lemmaClient, podId)
  const createItem = useRecordCreate(lemmaClient, podId)

  const grouped: Record<string, any[]> = {}
  STATUSES.forEach(s => { grouped[s] = [] })
  items.forEach((item: any) => {
    const status = item.status || 'draft'
    if (grouped[status]) grouped[status].push(item)
    else grouped[status] = [item]
  })

  async function moveItem(item: any, newStatus: string) {
    await updateItem.mutateAsync({ tableName: 'content_items', recordId: item.id, payload: { status: newStatus } })
    if (selectedItem?.id === item.id) {
      setSelectedItem({ ...selectedItem, status: newStatus })
    }
    refresh()
      notifyTableChanged('content_items')
    }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) return
    try {
      await createItem.mutateAsync({
        tableName: 'content_items',
        payload: {
          title: form.title,
          content_type: form.content_type,
          body: form.body,
          idea_id: form.idea_id || null,
          status: 'draft',
          ai_score: 0,
          seo_score: 0,
        }
      })
      setForm({ title: '', content_type: 'linkedin_post', body: '', idea_id: '' })
      setShowModal(false)
      refresh()
      notifyTableChanged('content_items')
    } catch (err) {
      console.error('Create failed:', err)
    }
  }

  function getStatusIndex(status: string): number {
    return STATUSES.indexOf(status as Status)
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Content Queue</h1>
          <p>Manage your content pipeline from draft to published</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={16} /> New Content
        </button>
      </div>

      {isLoading ? (
        <div className="card">
          <div className="skeleton" style={{ height: 200 }} />
        </div>
      ) : items.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <Columns3 size={40} />
            <h3>Your content queue is empty</h3>
            <p>Generate content using AI Writer or create it manually</p>
          </div>
        </div>
      ) : (
        <div className="kanban">
          {STATUSES.map(status => {
            const config = STATUS_CONFIG[status]
            const cols = grouped[status] || []
            return (
              <div key={status} className="kanban-col">
                <div className="kanban-col-header" style={{ color: config.color }}>
                  <span>{config.label}</span>
                  <span className="kanban-col-count">{cols.length}</span>
                </div>
                <div style={{ minHeight: 100 }}>
                  {cols.map((item: any) => (
                    <div key={item.id} className={`kanban-card ${selectedItem?.id === item.id ? 'selected' : ''}`}
                      onClick={() => setSelectedItem(item)}
                      style={{ cursor: 'pointer' }}>
                      <div className="kanban-card-title">{item.title || 'Untitled'}</div>
                      <div className="tag-group" style={{ marginBottom: 4 }}>
                        <span className="tag">{item.content_type}</span>
                      </div>
                      <div className="kanban-card-meta" style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Score: {item.ai_score ? `${Math.round(item.ai_score * 100)}%` : '—'}</span>
                        {getStatusIndex(status) < STATUSES.length - 1 && (
                          <button className="btn btn-xs btn-ghost" onClick={e => { e.stopPropagation(); moveItem(item, STATUSES[getStatusIndex(status) + 1]) }}
                            title={`Move to ${STATUSES[getStatusIndex(status) + 1]}`}>
                            <ArrowRight size={12} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Item detail panel */}
      {selectedItem && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-header">
            <div className="card-title">{selectedItem.title || 'Untitled'}</div>
            <button className="btn btn-sm btn-ghost" onClick={() => setSelectedItem(null)}>
              <X size={14} />
            </button>
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <span className="tag">{selectedItem.content_type}</span>
            <span className="badge" style={{ background: STATUS_CONFIG[selectedItem.status as Status]?.color || 'var(--ink-muted)', color: 'white' }}>
              {selectedItem.status}
            </span>
            {selectedItem.ai_score > 0 && (
              <span className="badge badge-approved">Score: {Math.round(selectedItem.ai_score * 100)}%</span>
            )}
          </div>
          <div style={{ background: 'var(--bg)', borderRadius: 'var(--radius-sm)', padding: 12, fontSize: 13, maxHeight: 200, overflowY: 'auto', whiteSpace: 'pre-wrap', marginBottom: 12 }}>
            {typeof selectedItem.body === 'string' ? selectedItem.body.substring(0, 2000) : 'No content'}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn btn-sm" onClick={() => moveItem(selectedItem, 'review')}
              disabled={selectedItem.status === 'review'}>
              <Send size={14} /> Send to Review
            </button>
            <button className="btn btn-sm btn-primary" onClick={() => moveItem(selectedItem, 'approved')}
              disabled={selectedItem.status === 'approved'}>
              <CheckCircle size={14} /> Approve
            </button>
            <button className="btn btn-sm" onClick={() => moveItem(selectedItem, 'scheduled')}
              disabled={selectedItem.status === 'scheduled'}>
              <Calendar size={14} /> Schedule
            </button>
            <button className="btn btn-sm" onClick={() => moveItem(selectedItem, 'published')}
              disabled={selectedItem.status === 'published'}>
              <Eye size={14} /> Publish
            </button>
            {selectedItem.status !== 'draft' && (
              <button className="btn btn-sm btn-ghost" onClick={() => moveItem(selectedItem, 'draft')}>
                <X size={14} /> Move to Draft
              </button>
            )}
          </div>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">New Content Item</div>
              <button className="btn btn-sm btn-ghost" onClick={() => setShowModal(false)}>
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="form-group">
                <label className="form-label">Content Type</label>
                <select className="form-select" value={form.content_type}
                  onChange={e => setForm(f => ({ ...f, content_type: e.target.value }))}>
                  {CONTENT_TYPE_OPTIONS.map(ct => (
                    <option key={ct} value={ct}>{ct.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Title</label>
                <input className="form-input" type="text" value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required />
              </div>
              <div className="form-group">
                <label className="form-label">Body</label>
                <textarea className="form-textarea" value={form.body}
                  onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
                  style={{ minHeight: 120 }} />
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" className="btn" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={createItem.isPending}>
                  {createItem.isPending ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
