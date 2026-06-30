import { useState, useEffect } from 'react'
import { useRecords } from 'lemma-sdk/react'
import { lemmaClient } from '../lemma-client'
import { onTableChange } from '../lib/refresh-bus'
import { Palette, TrendingUp, Sparkles, CheckCircle, AlertCircle } from 'lucide-react'

export function Themes() {
  const podId = lemmaClient.podId
  const [isClustering, setIsClustering] = useState(false)
  const [clusterResult, setClusterResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const { records: themes, isLoading, refresh } = useRecords({
    client: lemmaClient, podId, tableName: 'themes', limit: 50,
    sort: [{ field: 'trend_score', direction: 'desc' }]
  })

  const { records: ideas, refresh: refreshIdeas } = useRecords({
    client: lemmaClient, podId, tableName: 'ideas', limit: 500
  })

  const ideasById = new Map(ideas.map((i: any) => [i.id, i]))

  // Auto-refresh when themes or ideas table changes
  useEffect(() => {
    const unsub = onTableChange('themes', () => refresh())
    return unsub
  }, [refresh])

  useEffect(() => {
    const unsub = onTableChange('ideas', () => refreshIdeas())
    return unsub
  }, [refreshIdeas])

  function parseIds(theme: any): string[] {
    try {
      const ids = typeof theme.idea_ids === 'string' ? JSON.parse(theme.idea_ids) : theme.idea_ids
      return Array.isArray(ids) ? ids : []
    } catch { return [] }
  }

  function parseKeywords(theme: any): string[] {
    try {
      const kw = typeof theme.keywords === 'string' ? JSON.parse(theme.keywords) : theme.keywords
      return Array.isArray(kw) ? kw : []
    } catch { return [] }
  }

  async function handleCluster() {
    if (isClustering) return
    setIsClustering(true)
    setClusterResult(null)
    try {
      // The theme_clusterer agent has write access to the themes table
      // It reads ideas, clusters them, and creates/updates theme records directly
      const result = await lemmaClient.agents.run('theme_clusterer',
        'Analyze all non-archived ideas from the ideas table. ' +
        'Group similar ideas into coherent themes. ' +
        'Create new theme records in the themes table and update existing ones. ' +
        'Remove themes that no longer have any associated ideas. ' +
        'Return a detailed summary of what was created, updated, or removed.'
      )
      // The agent's response contains the clustering summary
      const summary = typeof result === 'string' ? result :
                      (result as any)?.response || (result as any)?.output || JSON.stringify(result)
      setClusterResult({ type: 'success', message: summary })
      refresh()
    } catch (err) {
      console.error('Clustering failed:', err)
      setClusterResult({
        type: 'error',
        message: `Clustering failed: ${err instanceof Error ? err.message : 'Unknown error'}`
      })
    } finally {
      setIsClustering(false)
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Themes</h1>
          <p>Automatically discovered themes and trends from your ideas</p>
        </div>
        <button className="btn btn-primary" onClick={handleCluster} disabled={isClustering}
          title="Run theme clustering on all non-archived ideas">
          <Sparkles size={16} />
          {isClustering ? 'Clustering...' : 'Cluster Themes'}
        </button>
      </div>

      {clusterResult && (
        <div className="card" style={{
          marginBottom: 16, padding: 12,
          background: clusterResult.type === 'error' ? '#fff0f0' : 'var(--accent-lighter)',
          border: `1px solid ${clusterResult.type === 'error' ? '#ffcccc' : 'var(--accent-lighter)'}`
        }}>
          <div style={{ display: 'flex', gap: 8 }}>
            {clusterResult.type === 'error'
              ? <AlertCircle size={16} style={{ color: '#e53e3e', flexShrink: 0, marginTop: 2 }} />
              : <CheckCircle size={16} style={{ color: '#38a169', flexShrink: 0, marginTop: 2 }} />
            }
            <div style={{ fontSize: 13, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
              {clusterResult.type === 'success'
                ? formatAgentSummary(clusterResult.message)
                : clusterResult.message
              }
            </div>
            <button
              className="btn btn-sm btn-ghost"
              style={{ marginLeft: 'auto', flexShrink: 0, padding: '2px 6px' }}
              onClick={() => setClusterResult(null)}
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="card">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 80 }} />)}
          </div>
        </div>
      ) : themes.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <Palette size={40} />
            <h3>No themes yet</h3>
            <p>Click "Cluster Themes" to analyze your ideas and discover patterns. The AI will group related ideas into themes, detect trends, and save them here.</p>
            {ideas.length > 0 && (
              <p style={{ fontSize: 13, color: 'var(--ink-muted)', marginTop: 4 }}>
                {ideas.length} idea{ideas.length !== 1 ? 's' : ''} available for clustering
              </p>
            )}
            {ideas.length === 0 && (
              <p style={{ fontSize: 13, color: 'var(--ink-muted)', marginTop: 4 }}>
                No ideas to cluster yet. Capture some ideas first on the Ideas page.
              </p>
            )}
            <button className="btn btn-primary" style={{ marginTop: 16 }}
              onClick={handleCluster} disabled={isClustering || ideas.length === 0}>
              <Sparkles size={16} /> Cluster Ideas into Themes
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {themes.map((theme: any) => {
            const ids = parseIds(theme)
            const keywords = parseKeywords(theme)
            const score = theme.trend_score || 0
            const linkedIdeas = ids.map(id => ideasById.get(id)).filter(Boolean)
            const isExpanded = expandedTheme === theme.id
            const workspace = themeWorkspace[theme.id]
            const workspaceIdeas = workspace?.ideas || []
            const workspaceFiles = workspace?.files || []
            const workspaceContent = workspace?.content || []
            const wsContentCount = (allContent as any[]).filter((c: any) => c.idea_id && ids.includes(c.idea_id)).length
            const wsFileCount = linkedIdeas.filter((i: any) => i.source_ref && i.source_ref.startsWith('/')).length

            return (
              <div key={theme.id}>
                {/* Theme Card — clickable to expand workspace */}
                <div
                  className="card"
                  style={{ cursor: 'pointer', borderLeft: isExpanded ? '3px solid var(--accent)' : undefined }}
                  onClick={() => expandTheme(theme)}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                    <div className={`score-ring ${score >= 0.7 ? 'score-high' : score >= 0.4 ? 'score-mid' : 'score-low'}`}
                      style={{ width: 48, height: 48, fontSize: 14, flexShrink: 0 }}>
                      {Math.round(score * 100)}%
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <h3 style={{ fontSize: 16, fontWeight: 600 }}>{theme.name}</h3>
                        <TrendingUp size={16} style={{ color: score >= 0.7 ? 'var(--green)' : 'var(--ink-muted)' }} />
                      </div>
                      {theme.description && (
                        <p style={{ color: 'var(--ink-secondary)', fontSize: 13, marginBottom: 8 }}>{theme.description}</p>
                      )}
                      {keywords.length > 0 && (
                        <div className="tag-group" style={{ marginBottom: 8 }}>
                          {keywords.map((kw: string) => <span key={kw} className="tag tag-sm">{kw}</span>)}
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--ink-muted)' }}>
                        <span><Eye size={12} style={{ display: 'inline' }} /> {linkedIdeas.length} ideas</span>
                        <span><FileText size={12} style={{ display: 'inline' }} /> {wsContentCount} content items</span>
                        <span><FolderOpen size={12} style={{ display: 'inline' }} /> {wsFileCount} files</span>
                      </div>
                    </div>
                    <button
                      className="btn btn-sm btn-ghost"
                      style={{ flexShrink: 0 }}
                      onClick={(e) => { e.stopPropagation(); expandTheme(theme) }}
                    >
                      <FolderOpen size={14} />
                    </button>
                  </div>
                </div>

                {/* Theme Workspace — File System View */}
                {isExpanded && (
                  <div className="card" style={{ marginTop: 2, padding: 16, borderTop: 'none', borderTopLeftRadius: 0, borderTopRightRadius: 0 }}>
                    <div>
                      <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <FolderOpen size={16} style={{ color: 'var(--accent)' }} />
                        {theme.name} — Workspace
                      </h3>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                        {/* Column 1: Ideas */}
                        <div className="card" style={{ padding: 12 }}>
                          <h4 style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-secondary)', marginBottom: 8 }}>
                            Ideas ({workspaceIdeas.length})
                          </h4>
                          {workspaceIdeas.length === 0 ? (
                            <p style={{ fontSize: 12, color: 'var(--ink-muted)', fontStyle: 'italic' }}>No linked ideas</p>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                              {workspaceIdeas.map((idea: any) => (
                                <div key={idea.id} style={{
                                  padding: '6px 8px', background: 'var(--bg)',
                                  borderRadius: 'var(--radius-sm)', fontSize: 12
                                }}>
                                  <div style={{ fontWeight: 500, marginBottom: 2 }}>{idea.title || 'Untitled'}</div>
                                  <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                                    <span className="tag tag-sm">{idea.source_type}</span>
                                    <span className={`badge badge-${idea.status}`} style={{ fontSize: 9, padding: '1px 4px' }}>{idea.status}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Column 2: Files */}
                        <div className="card" style={{ padding: 12 }}>
                          <h4 style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-secondary)', marginBottom: 8 }}>
                            Files ({workspaceFiles.length})
                          </h4>
                          {workspaceFiles.length === 0 ? (
                            <p style={{ fontSize: 12, color: 'var(--ink-muted)', fontStyle: 'italic' }}>No files attached to ideas in this theme</p>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                              {workspaceFiles.map((file: any, idx: number) => (
                                <div key={idx} style={{
                                  padding: '6px 8px', background: 'var(--bg)',
                                  borderRadius: 'var(--radius-sm)', fontSize: 12
                                }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <FileText size={12} style={{ color: 'var(--ink-muted)', flexShrink: 0 }} />
                                    <span style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</span>
                                  </div>
                                  <div style={{ fontSize: 10, color: 'var(--ink-muted)', marginTop: 2 }}>
                                    from: {file.title}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Column 3: Generated Content */}
                        <div className="card" style={{ padding: 12 }}>
                          <h4 style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-secondary)', marginBottom: 8 }}>
                            Generated Content ({workspaceContent.length})
                          </h4>
                          {workspaceContent.length === 0 ? (
                            <p style={{ fontSize: 12, color: 'var(--ink-muted)', fontStyle: 'italic' }}>No content generated from this theme's ideas yet</p>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                              {workspaceContent.map((item: any) => (
                                <div key={item.id} style={{
                                  padding: '6px 8px', background: 'var(--bg)',
                                  borderRadius: 'var(--radius-sm)', fontSize: 12
                                }}>
                                  <div style={{ fontWeight: 500, marginBottom: 2 }}>{item.title || 'Untitled'}</div>
                                  <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
                                    <span className="tag tag-sm">{item.content_type}</span>
                                    <span className={`badge badge-${item.status}`} style={{ fontSize: 9, padding: '1px 4px' }}>{item.status}</span>
                                    {item.ai_score > 0 && (
                                      <span style={{ fontSize: 10, color: 'var(--ink-muted)' }}>{Math.round(item.ai_score * 100)}%</span>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/** Extract the readable summary from the agent's verbose output */
function formatAgentSummary(text: string): React.ReactNode {
  // The agent response includes tool calls and results. Try to extract just the summary part.
  const lines = text.split('\n')
  // Find where the actual summary starts (after the last tool call)
  const summaryStart = Math.max(
    text.lastIndexOf('## ✅ Clustering Summary'),
    text.lastIndexOf('## Summary'),
    text.lastIndexOf('Themes'),
  )
  if (summaryStart >= 0) {
    return text.substring(summaryStart)
  }
  // If no section marker found, show the last ~800 chars (the summary portion)
  if (text.length > 1000) {
    return '…' + text.substring(text.length - 800)
  }
  return text
}
