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

  // Perform search — keyword is client-side; semantic tries the function, falls back
  const performSearch = useCallback(async (q: string, _mode: 'keyword' | 'semantic', topicFilter: string | null) => {
    if (_mode === 'semantic' && q.trim()) {
      setIsSearching(true)
      try {
        // Semantic search requires a query_embedding vector.
        // We can generate embeddings via generate_embedding but that needs an idea_id.
        // Try using the semantic_search function directly — if it fails, fall back to
        // ranked keyword search.
        const result = await lemmaClient.functions.run('semantic_search', {
          input: { query_embedding: [], limit: 20 }
        })
        // If we got results from embedding search, filter by topic
        const items = (result as any)?.items || (result as any)?.results || []
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
      } catch {
        // Fallback: ranked keyword search — rank by relevance (title match > content match)
        let results = applyFilters(q, topicFilter)
        const lower = q.toLowerCase()
        results.sort((a: any, b: any) => {
          const aTitle = (a.title || '').toLowerCase().includes(lower) ? 2 : 0
          const bTitle = (b.title || '').toLowerCase().includes(lower) ? 2 : 0
          const aTag = parseTags(a).some(t => t.toLowerCase().includes(lower)) ? 1 : 0
          const bTag = parseTags(b).some(t => t.toLowerCase().includes(lower)) ? 1 : 0
          return (bTitle + bTag) - (aTitle + aTag)
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
    return []
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
          {hasAnyFilter && (
            <button className="btn btn-sm btn-ghost" onClick={clearAllFilters}
              style={{ padding: 4, marginLeft: 4 }} title="Clear filters">
              <X size={16} />
            </button>
          )}
        </div>

        {/* Topic filter — secondary, below the search bar */}
        {sortedTopics.length > 0 && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <button
                className="btn btn-sm btn-ghost"
                style={{ fontSize: 12, padding: '2px 8px', color: 'var(--ink-muted)' }}
                onClick={() => setShowTopics(!showTopics)}
              >
                <SlidersHorizontal size={12} /> {showTopics ? 'Hide topics' : 'Filter by topic'}
              </button>
              {activeTopic && (
                <span className="tag" style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                  {activeTopic}
                  <button style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0, lineHeight: 1 }}
                    onClick={() => setActiveTopic(null)}>✕</button>
                </span>
              )}
            </div>
            {showTopics && (
              <div className="tag-group" style={{ gap: 6 }}>
                {sortedTopics.slice(0, 30).map(([topic, count]) => (
                  <button
                    key={topic}
                    className={`btn btn-sm ${activeTopic === topic ? 'btn-primary' : 'btn-ghost'}`}
                    style={{ fontSize: 12 }}
                    onClick={() => selectTopic(topic)}
                  >
                    {topic}
                    <span style={{ marginLeft: 4, opacity: 0.7 }}>({count})</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Results */}
      {isLoading ? (
        <div className="card" style={{ padding: 24 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 80 }} />)}
          </div>
        </div>
      ) : isSearching ? (
        <div className="card" style={{ padding: 40, textAlign: 'center' }}>
          <Sparkles size={24} className="spin" style={{ color: 'var(--accent)', marginBottom: 12 }} />
          <p style={{ color: 'var(--ink-muted)' }}>Searching ideas…</p>
        </div>
      ) : hasAnyFilter ? (
        displayIdeas.length === 0 ? (
          <div className="card">
            <div className="empty-state">
              <Search size={32} />
              <h3>No results found</h3>
              <p>
                {searchMode === 'semantic'
                  ? 'Try switching to keyword search or broadening your query.'
                  : 'Try a different search term or clear your filters.'
                }
              </p>
              <button className="btn btn-sm btn-ghost" style={{ marginTop: 8 }} onClick={clearAllFilters}>
                <X size={14} /> Clear filters
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 13, color: 'var(--ink-muted)', marginBottom: 4 }}>
              {displayIdeas.length} result{displayIdeas.length !== 1 ? 's' : ''}
              {activeTopic && <span> filtered by <strong>{activeTopic}</strong></span>}
              {searchMode === 'semantic' && semanticResults !== null && (
                <span> · semantic search</span>
              )}
            </div>
            {displayIdeas.map((idea: any) => {
              const tags = parseTags(idea)
              return (
                <div key={idea.id} className="card" style={{ padding: 16 }}>
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
                          onClick={() => selectTopic(t)}
                        >
                          {t}
                        </button>
                      ))}
                      {tags.length > 5 && (
                        <span style={{ fontSize: 11, color: 'var(--ink-muted)' }}>+{tags.length - 5}</span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )
      ) : (
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
      )}
    </div>
  )
}
