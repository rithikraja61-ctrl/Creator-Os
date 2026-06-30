import { useEffect } from 'react'
import { useRecords } from 'lemma-sdk/react'
import { lemmaClient } from '../lemma-client'
import { onTableChange } from '../lib/refresh-bus'
import { Lightbulb, FileText, Sparkles, TrendingUp, ArrowRight, Palette, CheckSquare } from 'lucide-react'
import { Link } from 'react-router-dom'

function StatCard({ icon, value, label, color }: { icon: React.ReactNode; value: string | number; label: string; color: string }) {
  return (
    <div className="card" style={{ borderLeft: `3px solid ${color}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ color }}>{icon}</span>
        <div>
          <div className="stat-value">{value}</div>
          <div className="stat-label">{label}</div>
        </div>
      </div>
    </div>
  )
}

export function Dashboard() {
  const podId = lemmaClient.podId

  // ── Stats: use total count from backend (limit=1 is enough to get the count) ──
  const { total: ideasTotal, isLoading: ideasLoading, refresh: refreshIdeas } = useRecords({
    client: lemmaClient, podId, tableName: 'ideas', limit: 1,
  })
  const { total: themesTotal, isLoading: themesLoading, refresh: refreshThemes } = useRecords({
    client: lemmaClient, podId, tableName: 'themes', limit: 1,
  })
  const { total: draftTotal, isLoading: draftsLoading, refresh: refreshDrafts } = useRecords({
    client: lemmaClient, podId, tableName: 'content_items', limit: 1,
    filters: [{ field: 'status', op: 'eq', value: 'draft' }],
  })
  const { total: reviewTotal, isLoading: reviewsLoading, refresh: refreshReviews } = useRecords({
    client: lemmaClient, podId, tableName: 'content_items', limit: 1,
    filters: [{ field: 'status', op: 'eq', value: 'review' }],
  })

  // ── Lists ──
  const { records: ideas, isLoading: ideasListLoading, refresh: refreshIdeasList } = useRecords({
    client: lemmaClient, podId, tableName: 'ideas', limit: 5,
    sort: [{ field: 'created_at', direction: 'desc' }],
  })
  const { records: drafts, isLoading: draftsListLoading, refresh: refreshDraftsList } = useRecords({
    client: lemmaClient, podId, tableName: 'content_items', limit: 5,
    filters: [{ field: 'status', op: 'eq', value: 'draft' }],
    sort: [{ field: 'created_at', direction: 'desc' }],
  })
  const { records: reviews, isLoading: reviewsListLoading, refresh: refreshReviewsList } = useRecords({
    client: lemmaClient, podId, tableName: 'content_items', limit: 5,
    filters: [{ field: 'status', op: 'eq', value: 'review' }],
    sort: [{ field: 'created_at', direction: 'desc' }],
  })
  const { records: themes, isLoading: themesListLoading, refresh: refreshThemesList } = useRecords({
    client: lemmaClient, podId, tableName: 'themes', limit: 5,
    sort: [{ field: 'trend_score', direction: 'desc' }],
  })

  // ── Auto-refresh when tables change ──
  useEffect(() => {
    const unsub = onTableChange(['ideas', 'content_items', 'themes'], () => {
      refreshIdeas(); refreshIdeasList()
      refreshDrafts(); refreshDraftsList()
      refreshReviews(); refreshReviewsList()
      refreshThemes(); refreshThemesList()
    })
    return unsub
  }, [])

  const isLoading = ideasLoading || draftsLoading || reviewsLoading || themesLoading
    || ideasListLoading || draftsListLoading || reviewsListLoading || themesListLoading

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p>Your content creation workspace at a glance</p>
        </div>
      </div>

      <div className="grid-4" style={{ marginBottom: 24 }}>
        <StatCard
          icon={<Lightbulb size={20} />}
          value={isLoading ? '…' : ideasTotal}
          label="Ideas captured"
          color="var(--blue)"
        />
        <StatCard
          icon={<FileText size={20} />}
          value={isLoading ? '…' : draftTotal}
          label="Drafts in progress"
          color="var(--amber)"
        />
        <StatCard
          icon={<Sparkles size={20} />}
          value={isLoading ? '…' : reviewTotal}
          label="Awaiting review"
          color="var(--purple)"
        />
        <StatCard
          icon={<TrendingUp size={20} />}
          value={isLoading ? '…' : themesTotal}
          label="Active themes"
          color="var(--green)"
        />
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-header">
            <div className="card-title">Recent Ideas</div>
            <Link to="/ideas" className="btn btn-sm btn-ghost">
              View all <ArrowRight size={14} />
            </Link>
          </div>
          {ideasListLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 40 }} />)}
            </div>
          ) : (ideas as any[])?.length === 0 ? (
            <div className="empty-state" style={{ padding: 24 }}>
              <Lightbulb size={32} />
              <h3>No ideas yet</h3>
              <p>Start capturing ideas in your Idea Inbox</p>
              <Link to="/ideas" className="btn btn-primary btn-sm" style={{ marginTop: 12 }}>
                Capture an idea
              </Link>
            </div>
          ) : (
            <table className="data-table">
              <thead><tr><th>Title</th><th>Status</th><th>Tags</th></tr></thead>
              <tbody>
                {(ideas as any[])?.map((idea: any) => (
                  <tr key={idea.id}>
                    <td style={{ fontWeight: 500 }}>{idea.title || 'Untitled'}</td>
                    <td><span className={`badge badge-${idea.status}`}>{idea.status}</span></td>
                    <td>
                      <div className="tag-group">
                        {(() => {
                          try {
                            const tags = typeof idea.tags === 'string' ? JSON.parse(idea.tags) : idea.tags
                            return Array.isArray(tags) ? tags.slice(0, 2).map((t: string) => (
                              <span key={t} className="tag">{t}</span>
                            )) : null
                          } catch { return null }
                        })()}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">Top Themes</div>
            <Link to="/themes" className="btn btn-sm btn-ghost">
              View all <ArrowRight size={14} />
            </Link>
          </div>
          {themesListLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 40 }} />)}
            </div>
          ) : (themes as any[])?.length === 0 ? (
            <div className="empty-state" style={{ padding: 24 }}>
              <Palette size={32} />
              <h3>No themes discovered</h3>
              <p>Add ideas and run theme clustering</p>
            </div>
          ) : (
            <table className="data-table">
              <thead><tr><th>Theme</th><th>Score</th><th>Ideas</th></tr></thead>
              <tbody>
                {(themes as any[])?.map((theme: any) => (
                  <tr key={theme.id}>
                    <td style={{ fontWeight: 500 }}>{theme.name}</td>
                    <td>
                      <span className={`badge ${(theme.trend_score || 0) >= 0.7 ? 'badge-approved' : (theme.trend_score || 0) >= 0.4 ? 'badge-draft' : 'badge-inbox'}`}>
                        {Math.round((theme.trend_score || 0) * 100)}%
                      </span>
                    </td>
                    <td style={{ color: 'var(--ink-muted)' }}>
                      {(() => {
                        try {
                          const ids = typeof theme.idea_ids === 'string' ? JSON.parse(theme.idea_ids) : theme.idea_ids
                          return Array.isArray(ids) ? ids.length : 0
                        } catch { return 0 }
                      })()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="grid-2" style={{ marginTop: 16 }}>
        <div className="card">
          <div className="card-header">
            <div className="card-title">Drafts In Progress</div>
            <Link to="/queue" className="btn btn-sm btn-ghost">
              View queue <ArrowRight size={14} />
            </Link>
          </div>
          {draftsListLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 40 }} />)}
            </div>
          ) : (drafts as any[])?.length === 0 ? (
            <div className="empty-state" style={{ padding: 24 }}>
              <FileText size={32} />
              <h3>No drafts</h3>
              <p>Use AI Writer to generate content from your ideas</p>
            </div>
          ) : (
            <table className="data-table">
              <thead><tr><th>Title</th><th>Type</th><th>Score</th></tr></thead>
              <tbody>
                {(drafts as any[])?.map((item: any) => (
                  <tr key={item.id}>
                    <td style={{ fontWeight: 500 }}>{item.title || 'Untitled'}</td>
                    <td><span className="tag">{item.content_type}</span></td>
                    <td>{(item.ai_score || 0) > 0 ? `${Math.round(item.ai_score * 100)}%` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">Needs Review</div>
            <Link to="/review" className="btn btn-sm btn-ghost">
              Review now <ArrowRight size={14} />
            </Link>
          </div>
          {reviewsListLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 40 }} />)}
            </div>
          ) : (reviews as any[])?.length === 0 ? (
            <div className="empty-state" style={{ padding: 24 }}>
              <CheckSquare size={32} />
              <h3>All caught up</h3>
              <p>No content items waiting for review</p>
            </div>
          ) : (
            <table className="data-table">
              <thead><tr><th>Title</th><th>Type</th><th>Status</th></tr></thead>
              <tbody>
                {(reviews as any[])?.map((item: any) => (
                  <tr key={item.id}>
                    <td style={{ fontWeight: 500 }}>{item.title || 'Untitled'}</td>
                    <td><span className="tag">{item.content_type}</span></td>
                    <td><span className="badge badge-review">review</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
