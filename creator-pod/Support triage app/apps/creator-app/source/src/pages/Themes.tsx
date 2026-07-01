import { useState, useEffect, useRef } from 'react'
import { useRecords } from 'lemma-sdk/react'
import { lemmaClient } from '../lemma-client'
import { onTableChange } from '../lib/refresh-bus'
import { useBackgroundTasks, CLUSTER_STEPS } from '../contexts/BackgroundTaskContext'
import {
  Palette, TrendingUp, Sparkles, CheckCircle, AlertTriangle,
  FolderOpen, FileText, Eye, ChevronDown, ChevronUp, RefreshCw,
  Loader2, Trash2
} from 'lucide-react'
import { HeaderTaskStatus } from '../components/background-tasks/HeaderTaskStatus'

type ThemesStatus = 'up-to-date' | 'outdated' | 'clustering'

// ── Recluster prompt ──

const CLUSTER_PROMPT = [
  'CRITICAL — Clean slate clustering:',
  '',
  '1. DELETE ALL existing themes from the themes table. Every single one.',
  '2. Then read all non-archived ideas from the ideas table.',
  '3. If zero ideas: stop immediately. Report "No ideas to cluster. All themes deleted."',
  '4. Otherwise, group similar ideas into coherent themes.',
  '5. Create FRESH theme records — never update, never merge, never append.',
  '6. The themes table must always represent ONLY the current ideas.',
  '7. Return a summary with the count of themes created and the count of ideas used.',
].join('\n')

// ── Helpers ──

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

// ── Component ──

export function Themes() {
  const podId = lemmaClient.podId
  const [expandedTheme, setExpandedTheme] = useState<string | null>(null)
  const [themeWorkspace, setThemeWorkspace] = useState<Record<string, any>>({})
  const [themesStatus, setThemesStatus] = useState<ThemesStatus>('up-to-date')
  const prevThemesLength = useRef(0)
  const prevTimestamp = useRef(0)
  const cleaningThemes = useRef(false)

  // ── Background task context ──
  const { startTask, activeTasks, tasks } = useBackgroundTasks()
  const isClustering = activeTasks.some(t => t.type === 'theme_clustering')

  // ── Records ──
  // ═══ BUG 3 FIX: Filter out archived ideas so length reflects only active ideas ═══
  const { records: themes, isLoading, refresh } = useRecords({
    client: lemmaClient, podId, tableName: 'themes', limit: 50,
    sort: [{ field: 'trend_score', direction: 'desc' }],
  })

  const { records: ideas, refresh: refreshIdeas } = useRecords({
    client: lemmaClient, podId, tableName: 'ideas', limit: 500,
    filters: [{ field: 'status', op: 'ne', value: 'archived' }],
  })

  const { records: content, refresh: refreshContent } = useRecords({
    client: lemmaClient, podId, tableName: 'content_items', limit: 500,
  })

  const { records: sources, refresh: refreshSources } = useRecords({
    client: lemmaClient, podId, tableName: 'sources', limit: 500,
  })

  const ideasById = useRef(new Map())
  ideasById.current = new Map(ideas.map((i: any) => [i.id, i]))
  const contentById = useRef(new Map())
  contentById.current = new Map(content.map((c: any) => [c.id, c]))

  // ═══ BUG 3 FIX: When zero ideas exist, delete/archive stale themes ═══
  useEffect(() => {
    if (isLoading || cleaningThemes.current) return
    if (ideas && ideas.length === 0 && themes.length > 0) {
      cleaningThemes.current = true
      // Delete all stale themes since there are no ideas to cluster
      const ids = themes.map((t: any) => t.id)
      lemmaClient.records.bulk.delete('themes', ids)
        .then(() => {
          refresh()
          setThemeWorkspace({})
        })
        .catch(err => {
          console.error('Failed to clean up stale themes:', err)
        })
        .finally(() => {
          cleaningThemes.current = false
        })
    }
  }, [ideas, themes, isLoading, refresh])

  // ── Auto-refresh from table changes ──
  useEffect(() => {
    const unsub = onTableChange('themes', () => {
      refresh()
      // Detect if themes were freshly updated (animate in)
      prevTimestamp.current = Date.now()
    })
    return unsub
  }, [refresh])

  useEffect(() => {
    const unsub = onTableChange('ideas', () => {
      refreshIdeas()
      if (!isClustering) {
        setThemesStatus('outdated')
      }
    })
    return unsub
  }, [refreshIdeas, isClustering])

  useEffect(() => {
    const unsub = onTableChange('content_items', () => refreshContent())
    return unsub
  }, [refreshContent])

  useEffect(() => {
    const unsub = onTableChange('sources', () => refreshSources())
    return unsub
  }, [refreshSources])

  // ── Listen for clustering task completion → auto-refresh ──
  useEffect(() => {
    // When a clustering task completes, refresh everything and mark up-to-date
    const completedClusterTask = tasks.find(
      t => t.type === 'theme_clustering' && t.status === 'completed'
    )
    if (completedClusterTask && completedClusterTask.finishedAt &&
        completedClusterTask.finishedAt > prevTimestamp.current) {
      prevTimestamp.current = completedClusterTask.finishedAt
      Promise.all([
        refresh(),
        refreshIdeas(),
        refreshContent(),
        refreshSources(),
      ]).then(() => {
        setThemesStatus('up-to-date')
      })
    }
  }, [tasks, refresh, refreshIdeas, refreshContent, refreshSources])

  // ── When clustering starts, update status ──
  useEffect(() => {
    if (isClustering) {
      setThemesStatus('clustering')
    }
  }, [isClustering])

  // ── Build workspace data for expanded themes ──
  useEffect(() => {
    if (themes.length === 0 || ideas.length === 0) return

    const workspace: Record<string, any> = {}
    themes.forEach((theme: any) => {
      try {
        const ids = parseIds(theme)
        const linkedIdeas = ids.map((id: string) => ideasById.current.get(id)).filter(Boolean)

        const workspaceFiles: any[] = []
        const workspaceContent: any[] = []

        linkedIdeas.forEach((idea: any) => {
          if (idea.source_ref && idea.source_ref.startsWith('/')) {
            workspaceFiles.push({
              name: idea.title || 'Unnamed file',
              title: `Attached to: ${idea.title || 'Idea'}`,
            })
          }
          content.filter((c: any) => c.idea_id === idea.id).forEach((c: any) => {
            workspaceContent.push(c)
          })
        })

        workspace[theme.id] = {
          ideas: linkedIdeas,
          files: workspaceFiles,
          content: workspaceContent,
        }
      } catch {
        workspace[theme.id] = { ideas: [], files: [], content: [] }
      }
    })
    setThemeWorkspace(workspace)
  }, [themes, ideas, content])

  // ── Animate theme card changes ──
  const themeCardsChanged = themes.length !== prevThemesLength.current
  prevThemesLength.current = themes.length

  // ═══ BUG 2 FIX: Guard against reclustering with zero ideas ═══
  function handleRecluster() {
    if (isClustering) return
    if (!ideas || ideas.length === 0) {
      // Double guard — button is disabled but this catches edge cases
      return
    }
    startTask({
      type: 'theme_clustering',
      title: 'Reclustering Themes',
      agentName: 'theme_clusterer',
      steps: CLUSTER_STEPS,
      prompt: CLUSTER_PROMPT,
      metadata: {
        originalPrompt: CLUSTER_PROMPT,
        ideaCount: ideas.length,
      },
    })
  }

  // ── Status badge config ──
  const statusConfig = {
    'up-to-date': {
      icon: CheckCircle, color: 'var(--green)', label: 'Themes up to date',
      bg: 'var(--green-soft)',
    },
    'outdated': {
      icon: AlertTriangle, color: 'var(--amber)', label: 'Themes need updating',
      bg: 'var(--amber-soft)',
    },
    'clustering': {
      icon: Loader2, color: 'var(--accent)', label: 'AI organizing ideas...',
      bg: 'var(--accent-lighter)',
    },
  }
  const StatusIcon = statusConfig[themesStatus].icon

  // ═══ Derived state for empty/message states ═══
  const hasActiveIdeas = ideas && ideas.length > 0

  // ── Render ──
  return (
    <div>
      {/* ── Page Header ── */}
      <div className="page-header">
        <div>
          <h1>Themes</h1>
          <p>Automatically discovered themes and trends from your ideas</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <HeaderTaskStatus
              themesStatus={themesStatus}
              onRecluster={handleRecluster}
              isReclusterDisabled={isClustering || !hasActiveIdeas}
            />
            {themesStatus !== 'outdated' && (
              <button
                className="btn btn-primary"
                onClick={handleRecluster}
                disabled={isClustering || !hasActiveIdeas}
                title={!hasActiveIdeas ? 'No ideas to cluster' : 'Recluster themes from scratch'}
              >
                <RefreshCw size={16} style={{
                  animation: isClustering ? 'ftcSpin 1s linear infinite' : undefined,
                }} />
                {isClustering ? 'Reclustering…' : 'Recluster'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Loading skeleton ── */}
      {isLoading ? (
        <div className="card">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[1, 2, 3].map(i => (
              <div key={i} className="skeleton" style={{ height: 80 }} />
            ))}
          </div>
        </div>
      ) : themes.length === 0 && hasActiveIdeas ? (
        // ═══ BUG 3 FIX: Ideas exist but no themes yet — unchanged ═══
        <div className="card">
          <div className="empty-state">
            <Palette size={40} />
            <h3>No themes yet</h3>
            <p>Click Recluster to analyze your ideas and discover patterns.</p>
            <p style={{ fontSize: 13, color: 'var(--ink-muted)', marginTop: 4 }}>
              {ideas.length} idea{ideas.length !== 1 ? 's' : ''} available for clustering
            </p>
            <button
              className="btn btn-primary" style={{ marginTop: 16 }}
              onClick={handleRecluster}
              disabled={isClustering}
            >
              <Sparkles size={16} /> Cluster Ideas into Themes
            </button>
          </div>
        </div>
      ) : !hasActiveIdeas && themes.length === 0 ? (
        // ═══ BUG 2 & 3 FIX: Zero ideas, no themes — show "capture ideas" message ═══
        <div className="card">
          <div className="empty-state">
            <Palette size={40} />
            <h3>No ideas available</h3>
            <p>Capture ideas before reclustering.</p>
          </div>
        </div>
      ) : !hasActiveIdeas && themes.length > 0 ? (
        // ═══ BUG 3 FIX: Zero ideas but stale themes exist — themes are being cleaned up ═══
        <div className="card">
          <div className="empty-state">
            <Loader2 size={40} style={{ animation: 'ftcSpin 1s linear infinite', color: 'var(--accent)' }} />
            <h3>Cleaning up stale themes...</h3>
            <p>Old themes are being removed. Capture new ideas to discover fresh themes.</p>
          </div>
        </div>
      ) : (
        // Themes list
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {themes.map((theme: any, idx: number) => {
            const ids = parseIds(theme)
            const keywords = parseKeywords(theme)
            const score = theme.trend_score || 0
            const linkedIdeas = ids.map((id: string) => ideasById.current.get(id)).filter(Boolean)
            const isExpanded = expandedTheme === theme.id
            const workspace = themeWorkspace[theme.id] || { ideas: [], files: [], content: [] }
            const workspaceIdeas = workspace.ideas || []
            const workspaceFiles = workspace.files || []
            const workspaceContent = workspace.content || []
            const wsContentCount = content.filter(
              (c: any) => c.idea_id && ids.includes(c.idea_id)
            ).length
            const wsFileCount = linkedIdeas.filter(
              (i: any) => i.source_ref && i.source_ref.startsWith('/')
            ).length

            return (
              <div
                key={theme.id}
                style={{
                  animation: themeCardsChanged
                    ? `ftcThemeFadeIn 0.4s ease-out ${idx * 0.05}s both`
                    : undefined,
                }}
              >
                {/* Theme card */}
                <div
                  className="card"
                  style={{
                    cursor: 'pointer',
                    borderLeft: isExpanded ? '3px solid var(--accent)' : undefined,
                    transition: 'border-color 0.3s, box-shadow 0.3s',
                  }}
                  onClick={() => setExpandedTheme(prev => prev === theme.id ? null : theme.id)}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                    <div
                      className={`score-ring ${score >= 0.7 ? 'score-high' : score >= 0.4 ? 'score-mid' : 'score-low'}`}
                      style={{ width: 48, height: 48, fontSize: 14, flexShrink: 0 }}
                    >
                      {Math.round(score * 100)}%
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <h3 style={{ fontSize: 16, fontWeight: 600 }}>{theme.name}</h3>
                        <TrendingUp
                          size={16}
                          style={{ color: score >= 0.7 ? 'var(--green)' : 'var(--ink-muted)' }}
                        />
                      </div>
                      {theme.description && (
                        <p style={{ color: 'var(--ink-secondary)', fontSize: 13, marginBottom: 8 }}>
                          {theme.description}
                        </p>
                      )}
                      {keywords.length > 0 && (
                        <div className="tag-group" style={{ marginBottom: 8 }}>
                          {keywords.map((kw: string) => (
                            <span key={kw} className="tag tag-sm">{kw}</span>
                          ))}
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--ink-muted)' }}>
                        <span>
                          <Eye size={12} style={{ display: 'inline' }} /> {linkedIdeas.length} ideas
                        </span>
                        <span>
                          <FileText size={12} style={{ display: 'inline' }} /> {wsContentCount} content items
                        </span>
                        <span>
                          <FolderOpen size={12} style={{ display: 'inline' }} /> {wsFileCount} files
                        </span>
                      </div>
                    </div>
                    <button
                      className="btn btn-sm btn-ghost"
                      style={{ flexShrink: 0 }}
                      onClick={(e) => {
                        e.stopPropagation()
                        setExpandedTheme(prev => prev === theme.id ? null : theme.id)
                      }}
                    >
                      {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                  </div>
                </div>

                {/* Expanded workspace */}
                {isExpanded && (
                  <div
                    className="card"
                    style={{
                      marginTop: 2, padding: 16,
                      borderTop: 'none', borderTopLeftRadius: 0, borderTopRightRadius: 0,
                      animation: 'ftcSlideIn 0.2s ease-out',
                    }}
                  >
                    <div>
                      <div style={{
                        display: 'flex', justifyContent: 'space-between',
                        alignItems: 'center', marginBottom: 12,
                      }}>
                        <h3 style={{
                          fontSize: 15, fontWeight: 600,
                          display: 'flex', alignItems: 'center', gap: 8,
                        }}>
                          <FolderOpen size={16} style={{ color: 'var(--accent)' }} />
                          {theme.name} — Workspace
                        </h3>
                        <button
                          onClick={() => setExpandedTheme(null)}
                          className="btn btn-sm btn-ghost"
                          style={{ color: 'var(--ink-muted)' }}
                        >
                          Collapse
                        </button>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                        {/* Ideas column */}
                        <div className="card" style={{ padding: 12 }}>
                          <h4 style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-secondary)', marginBottom: 8 }}>
                            Ideas ({workspaceIdeas.length})
                          </h4>
                          {workspaceIdeas.length === 0 ? (
                            <p style={{ fontSize: 12, color: 'var(--ink-muted)', fontStyle: 'italic' }}>
                              No linked ideas
                            </p>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                              {workspaceIdeas.map((idea: any) => (
                                <div key={idea.id} style={{
                                  padding: '6px 8px', background: 'var(--bg)',
                                  borderRadius: 'var(--radius-sm)', fontSize: 12,
                                }}>
                                  <div style={{ fontWeight: 500, marginBottom: 2 }}>
                                    {idea.title || 'Untitled'}
                                  </div>
                                  <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                                    <span className="tag tag-sm">{idea.source_type}</span>
                                    <span
                                      className={`badge badge-${idea.status}`}
                                      style={{ fontSize: 9, padding: '1px 4px' }}
                                    >
                                      {idea.status}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Files column */}
                        <div className="card" style={{ padding: 12 }}>
                          <h4 style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-secondary)', marginBottom: 8 }}>
                            Files ({workspaceFiles.length})
                          </h4>
                          {workspaceFiles.length === 0 ? (
                            <p style={{ fontSize: 12, color: 'var(--ink-muted)', fontStyle: 'italic' }}>
                              No files attached
                            </p>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                              {workspaceFiles.map((file: any, idx: number) => (
                                <div key={idx} style={{
                                  padding: '6px 8px', background: 'var(--bg)',
                                  borderRadius: 'var(--radius-sm)', fontSize: 12,
                                }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <FileText size={12} style={{ color: 'var(--ink-muted)', flexShrink: 0 }} />
                                    <span style={{
                                      fontWeight: 500, overflow: 'hidden',
                                      textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                    }}>
                                      {file.name}
                                    </span>
                                  </div>
                                  <div style={{ fontSize: 10, color: 'var(--ink-muted)', marginTop: 2 }}>
                                    from: {file.title}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Content column */}
                        <div className="card" style={{ padding: 12 }}>
                          <h4 style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-secondary)', marginBottom: 8 }}>
                            Generated Content ({workspaceContent.length})
                          </h4>
                          {workspaceContent.length === 0 ? (
                            <p style={{ fontSize: 12, color: 'var(--ink-muted)', fontStyle: 'italic' }}>
                              No content generated from this theme's ideas yet
                            </p>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                              {workspaceContent.map((item: any) => (
                                <div key={item.id} style={{
                                  padding: '6px 8px', background: 'var(--bg)',
                                  borderRadius: 'var(--radius-sm)', fontSize: 12,
                                }}>
                                  <div style={{ fontWeight: 500, marginBottom: 2 }}>
                                    {item.title || 'Untitled'}
                                  </div>
                                  <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
                                    <span className="tag tag-sm">{item.content_type}</span>
                                    <span
                                      className={`badge badge-${item.status}`}
                                      style={{ fontSize: 9, padding: '1px 4px' }}
                                    >
                                      {item.status}
                                    </span>
                                    {item.ai_score > 0 && (
                                      <span style={{ fontSize: 10, color: 'var(--ink-muted)' }}>
                                        {Math.round(item.ai_score * 100)}%
                                      </span>
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

      {/* ── Global animation keyframes ── */}
      <style>{`
        @keyframes ftcSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes ftcSlideIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes ftcThemeFadeIn {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
