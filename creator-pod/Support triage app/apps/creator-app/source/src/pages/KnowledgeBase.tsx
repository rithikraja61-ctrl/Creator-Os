import { useState, useEffect, useCallback } from 'react'
import { useRecords } from 'lemma-sdk/react'
import { lemmaClient } from '../lemma-client'
import { onTableChange } from '../lib/refresh-bus'
import { Search, Sparkles, X, Bookmark, MessageSquare, FileText, Link as LinkIcon, Type, SlidersHorizontal } from 'lucide-react'
import { Link } from 'react-router-dom'

export function KnowledgeBase() {
  const podId = lemmaClient.podId
  const [query, setQuery] = useState('')
  const [searchMode, setSearchMode] = useState<'keyword' | 'semantic'>('keyword')
  const [semanticResults, setSemanticResults] = useState<any[] | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const [activeTopic, setActiveTopic] = useState<string | null>(null)
  const [showTopics, setShowTopics] = useState(false)

  const { records: ideas, isLoading, refresh } = useRecords({
    client: lemmaClient, podId, tableName: 'ideas', limit: 500,
    sort: [{ field: 'created_at', direction: 'desc' }]
  })

  // Auto-refresh when ideas table changes
  useEffect(() => {
    const unsub = onTableChange('ideas', () => refresh())
    return unsub
  }, [])

  function parseTags(idea: any): string[] {
    try {
      const tags = typeof idea.tags === 'string' ? JSON.parse(idea.tags) : idea.tags
      return Array.isArray(tags) ? tags : []
    } catch { return [] }
  }

  function parseAiTags(idea: any): Record<string, unknown> | null {
    try {
      const ai = typeof idea.ai_tags === 'string' ? JSON.parse(idea.ai_tags) : idea.ai_tags
      return (ai && typeof ai === 'object') ? ai : null
    } catch { return null }
  }

  function getContentPreview(idea: any, maxLen = 150): string {
    const content = idea.content || ''
    if (content.length <= maxLen) return content
    return content.substring(0, maxLen) + '…'
  }

  function getSourceIcon(type: string) {
    switch (type) {
      case 'bookmark': return <Bookmark size={14} />
      case 'url': return <LinkIcon size={14} />
      case 'chat': return <MessageSquare size={14} />
      case 'pdf': return <FileText size={14} />
      case 'screenshot': return <FileText size={14} />
      default: return <Type size={14} />
    }
  }

  // Build topic groups from tags and ai_tags for the filter
  const topicCounts = new Map<string, number>()
  ideas.forEach((idea: any) => {
    const tags = parseTags(idea)
    tags.forEach(tag => topicCounts.set(tag, (topicCounts.get(tag) || 0) + 1))
    const ai = parseAiTags(idea)
    if (ai?.inferred_topics && Array.isArray(ai.inferred_topics)) {
      ;(ai.inferred_topics as string[]).forEach(topic =>
        topicCounts.set(topic, (topicCounts.get(topic) || 0) + 1)
      )
    }
  })
  const sortedTopics = Array.from(topicCounts.entries()).sort((a, b) => b[1] - a[1])

  // Apply keyword + topic filter
  function applyFilters(q: string, topicFilter: string | null): any[] {
    let filtered = ideas
    if (q.trim()) {
      const lower = q.toLowerCase()
      filtered = filtered.filter((idea: any) => {
        const searchable = `${idea.title || ''} ${idea.content || ''} ${parseTags(idea).join(' ')}`.toLowerCase()
        return searchable.includes(lower)
      })
    }
    if (topicFilter) {
      filtered = filtered.filter((idea: any) => {
        const allTags = [
          ...parseTags(idea),
          ...(parseAiTags(idea)?.inferred_topics as string[] || [])
        ]
        return allTags.some(t => t.toLowerCase() === topicFilter.toLowerCase())
      })
    }
    return filtered
  }

  // Perform search - semantic uses real embeddings when available
  const performSearch = useCallback(async (q: string, _mode: 'keyword' | 'semantic', topicFilter: string | null) => {
    if (_mode === 'semantic' && q.trim()) {
      setIsSearching(true)
      try {
        // Generate an embedding for the query using the generate_embedding function
        // This requires an idea_id, but we can use a temporary placeholder or a special ID
        const tempId = 'search-query'
        await lemmaClient.functions.run('generate_embedding', {
          input: { idea_id: tempId, text: q }
        })
        
        // Try semantic search with the generated embedding
        const result = await lemmaClient.functions.run('semantic_search', {
          input: { query_text: q, limit: 20 }
        })
        
        const items = (result as any)?.items || (result as any)?.results || []
        if (items.length > 0) {
          // Filter by topic if needed
          let filtered = items
          if (topicFilter) {
            filtered = items.filter((idea: any) => {
              const allTags = [
                ...parseTags(idea),
                ...(parseAiTags(idea)?.inferred_topics as string[] || [])
              ]
              return allTags.some(t => t.toLowerCase() === topicFilter.toLowerCase())
            })
          }
          setSemanticResults(filtered)
          return
        }
        throw new Error('No semantic results found')
      } catch {
        // Fallback: ranked keyword search with better relevance
        let results = applyFilters(q, topicFilter)
        const lower = q.toLowerCase()
        results.sort((a: any, b: any) => {
          const aTitle = (a.title || '').toLowerCase().includes(lower) ? 3 : 0 // Higher weight for title matches
          const bTitle = (b.title || '').toLowerCase().includes(lower) ? 3 : 0
          const aExact = (a.title || '').toLowerCase() === lower ? 5 : 0 // Exact title match gets top priority
          const bExact = (b.title || '').toLowerCase() === lower ? 5 : 0
          const aTag = parseTags(a).some(t => t.toLowerCase().includes(lower)) ? 2 : 0
          const bTag = parseTags(b).some(t => t.toLowerCase().includes(lower)) ? 2 : 0
          const aContent = a.content ? (a.content.toLowerCase().includes(lower) ? 1 : 0) : 0
          const bContent = b.content ? (b.content.toLowerCase().includes(lower) ? 1 : 0) : 0
          return (bExact + bTitle + bTag + bContent) - (aExact + aTitle + aTag + aContent)
        })
        setSemanticResults(results)
      } finally {
        setIsSearching(false)
      }
    } else {
      setSemanticResults(null)
    }
  }, [ideas])

  // Determine current results
  const displayIdeas: any[] = (() => {
    if (semanticResults !== null) return semanticResults
    if (query.trim() || activeTopic) {
      return applyFilters(query, activeTopic)
    }
    // When no query and no filter, show all ideas (not a placeholder)
    return ideas
  })()

  // Debounced search for semantic mode
  useEffect(() => {
    if (searchMode === 'semantic' && query.trim()) {
      const t = setTimeout(() => performSearch(query, searchMode, activeTopic), 400)
      return () => clearTimeout(t)
    }
    setSemanticResults(null)
  }, [query, searchMode, activeTopic, performSearch])

  function handleQueryChange(e: React.ChangeEvent<HTMLInputElement>) {
    setQuery(e.target.value)
  }

  function selectTopic(topic: string) {
    setActiveTopic(activeTopic === topic ? null : topic)
  }

  function clearAllFilters() {
    setQuery('')
    setActiveTopic(null)
    setSemanticResults(null)
  }

  const hasAnyFilter = query.trim() || activeTopic

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Knowledge Base</h1>
          <p>Search and explore your collected ideas</p>
        </div>
      </div>

      {/* Prominent search card */}
      <div className="card" style={{ marginBottom: 20, padding: 20 }}>
        <div className="search-bar" style={{ marginBottom: 12 }}>
          <Search size={18} style={{ color: 'var(--ink-muted)' }} />
          <input
            type="text"
            placeholder="Search your ideas by title, content, or tags…"
            value={query}
            onChange={handleQueryChange}
            style={{ fontSize: 15, padding: '8px 4px' }}
          />
          <div style={{ display: 'flex', gap: 4, marginLeft: 'auto', alignItems: 'center' }}>
            <button
              className={`btn btn-sm ${searchMode === 'keyword' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => { setSearchMode('keyword'); setSemanticResults(null) }}
              style={{ fontSize: 12 }}
            >
              Keyword
            </button>
            <button
              className={`btn btn-sm ${searchMode === 'semantic' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => { setSearchMode('semantic'); setSemanticResults(null) }}
              style={{ fontSize: 12 }}
            >
              <Sparkles size={12} /> Semantic
            </button>
          </div>
        </div>
        <div style={{ fontSize: 12, color: 'var(--ink-muted)', display: 'flex', alignItems: 'center', gap: 8 }}>
          {isSearching && <Sparkles size={14} style={{ animation: 'pulse 1s infinite' }} />}
          {isSearching && <span>Performing semantic search...</span>}
          {hasAnyFilter && !isSearching && displayIdeas.length === 0 && <span>No results match your search.</span>}
          {hasAnyFilter && !isSearching && displayIdeas.length > 0 && (
            <span>{displayIdeas.length} result{displayIdeas.length !== 1 ? 's' : ''}</span>
          )}
        </div>
      </div>

      {!hasAnyFilter && !isSearching && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
          {showTopics && sortedTopics.length > 0 && sortedTopics.slice(0, 30).map(([topic, count]) => (
            <button
              key={topic}
              className={`btn btn-sm ${activeTopic === topic ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => selectTopic(topic)}
              style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}
            >
              {topic}
              <span style={{ opacity: 0.7 }}>({count})</span>
            </button>
          ))}
          {sortedTopics.length > 0 && (
            <button
              className="btn btn-sm btn-ghost"
              style={{ fontSize: 12, color: 'var(--ink-muted)' }}
              onClick={() => setShowTopics(!showTopics)}
            >
              {showTopics ? 'Hide' : 'Show'} all topics ({sortedTopics.length})
            </button>
          )}
        </div>
      )}

      {hasAnyFilter && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          {query.trim() && (
            <span className="tag">
              Query: "{query}" 
              <button className="btn btn-xs btn-ghost" onClick={() => setQuery('')}><X size={12} /></button>
            </span>
          )}
          {activeTopic && (
            <span className="tag">
              Topic: {activeTopic}
              <button className="btn btn-xs btn-ghost" onClick={() => setActiveTopic(null)}><X size={12} /></button>
            </span>
          )}
          {hasAnyFilter && (
            <button className="btn btn-xs btn-ghost" onClick={clearAllFilters} style={{ color: 'var(--ink-muted)' }}>
              <X size={12} /> Clear all
            </button>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="card">
          <div style={{ padding: 40, textAlign: 'center' }}>
            <Search size={40} style={{ color: 'var(--ink-muted)', marginBottom: 16, opacity: 0.3 }} />
            <div style={{ fontSize: 14, color: 'var(--ink-muted)' }}>Loading your knowledge base...</div>
          </div>
        </div>
      ) : ideas.length === 0 ? (
        <div className="card">
          <div className="empty-state" style={{ padding: 48 }}>
            <Search size={48} />
            <h3>Your knowledge base is empty</h3>
            <p>Start capturing ideas to build your knowledge repository</p>
            <Link to="/ideas" className="btn btn-primary btn-sm" style={{ marginTop: 16 }}>
              Capture your first idea
            </Link>
          </div>
        </div>
      ) : displayIdeas.length === 0 && hasAnyFilter ? (
        <div className="card" style={{ padding: 40, textAlign: 'center' }}>
          <Search size={40} style={{ color: 'var(--ink-muted)', marginBottom: 16, opacity: 0.4 }} />
          <h3>No results found</h3>
          <p>Try different keywords or browse by topic</p>
          {activeTopic && (
            <button className="btn btn-sm" style={{ marginTop: 12 }} onClick={() => setActiveTopic(null)}>
              Clear topic filter
            </button>
          )}
        </div>
      ) : displayIdeas.length === 0 && !hasAnyFilter ? (
        /* No query, no filter — show search prompt, not topic cards */
        <div className="card" style={{ padding: 48, textAlign: 'center' }}>
          <Search size={48} style={{ color: 'var(--ink-muted)', marginBottom: 16, opacity: 0.4 }} />
          <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>
            Search your ideas
          </h2>
          <p style={{ color: 'var(--ink-secondary)', marginBottom: 16, maxWidth: 400, margin: '0 auto 16px' }}>
            Type a keyword above to search your ideas, or use semantic search to find related content by meaning.
          </p>
          {sortedTopics.length > 0 && (
            <div>
              <p style={{ fontSize: 13, color: 'var(--ink-muted)', marginBottom: 8 }}>
                Or browse by topic:
              </p>
              <div className="tag-group" style={{ justifyContent: 'center', gap: 8 }}>
                {sortedTopics.slice(0, 12).map(([topic, count]) => (
                  <button
                    key={topic}
                    className="btn btn-sm btn-ghost"
                    onClick={() => selectTopic(topic)}
                    style={{ fontSize: 13 }}
                  >
                    {topic}
                    <span style={{ marginLeft: 4, opacity: 0.7 }}>({count})</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {sortedTopics.length === 0 && !isLoading && (
            <p style={{ fontSize: 13, color: 'var(--ink-muted)' }}>
              No tagged ideas yet. Capture ideas and enable auto-tagging to organize them.
            </p>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {displayIdeas.map((idea: any) => {
            const tags = parseTags(idea)
            return (
              <div key={idea.id} className="card" style={{ padding: 16, cursor: 'pointer' }}
                onClick={() => {
                  // Handle idea selection if needed
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                  <div style={{ color: 'var(--ink-muted)', flexShrink: 0, marginTop: 4 }}>
                    {getSourceIcon(idea.source_type)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>
                        <Link to={`/ideas`} style={{ color: 'inherit', textDecoration: 'none' }}>
                          {idea.title || 'Untitled'}
                        </Link>
                      </h3>
                      <span className={`badge badge-${idea.status}`} style={{ fontSize: 11 }}>
                        {idea.status}
                      </span>
                    </div>
                    {idea.content && (
                      <p style={{ fontSize: 13, color: 'var(--ink-secondary)', margin: '4px 0 8px', lineHeight: 1.4 }}>
                        {getContentPreview(idea)}
                      </p>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      {idea.source_type && (
                        <span className="tag tag-sm" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          {getSourceIcon(idea.source_type)}
                          {idea.source_type}
                        </span>
                      )}
                      {tags.slice(0, 5).map((t: string) => (
                        <button key={t}
                          className="tag tag-sm"
                          style={{ cursor: 'pointer', border: 'none', background: 'var(--accent-lighter)' }}
                          onClick={(e) => {
                            e.stopPropagation()
                            selectTopic(t)
                          }}
                        >
                          {t}
                        </button>
                      ))}
                      {tags.length > 5 && (
                        <span style={{ fontSize: 11, color: 'var(--ink-muted)' }}>+{tags.length - 5}</span>
                      )}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', fontSize: 12, color: 'var(--ink-muted)', flexShrink: 0 }}>
                    <div style={{ marginBottom: 4 }}>{new Date(idea.created_at).toLocaleDateString()}</div>
                    {idea.ai_score > 0 && (
                      <div style={{ color: idea.ai_score > 0.7 ? 'var(--green)' : 'var(--ink-muted)' }}>
                        {Math.round(idea.ai_score * 100)}% score
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
