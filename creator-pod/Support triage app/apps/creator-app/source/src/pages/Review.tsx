import { useState, useEffect } from 'react'
import { useRecords, useRecordUpdate } from 'lemma-sdk/react'
import { lemmaClient } from '../lemma-client'
import { CheckSquare, CheckCircle, XCircle, Sparkles, ExternalLink, Send } from 'lucide-react'
import { notifyTableChanged, onTableChange } from '../lib/refresh-bus'

interface ContentItem {
  id: string
  title?: string
  content_type?: string
  body?: string
  status?: string
  ai_review?: string | Record<string, unknown>
  ai_score?: number
  [key: string]: unknown
}

interface ReviewScores {
  grammar?: number
  clarity?: number
  readability?: number
  engagement?: number
  seo?: number
  notes?: string
  duplicate?: boolean
  suggestions?: string[]
  approved?: boolean
  overall_score?: number
  [key: string]: unknown
}

export function Review() {
  const podId = lemmaClient.podId
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [isReviewing, setIsReviewing] = useState(false)
  const [reviewResult, setReviewResult] = useState<{ message: string; scores?: ReviewScores } | null>(null)
  const [error, setError] = useState('')
  const updateItem = useRecordUpdate(lemmaClient, podId)

  const { records: items, isLoading, refresh } = useRecords({
    client: lemmaClient, podId, tableName: 'content_items', limit: 200,
    sort: [{ field: 'updated_at', direction: 'desc' }]
  })

  // Auto-refresh when content items change
  useEffect(() => {
    const unsub = onTableChange('content_items', () => refresh())
    return unsub
  }, [refresh])

  const reviewItems = (items as ContentItem[]).filter((i: ContentItem) => i.status === 'review')
  const selected = (items as ContentItem[]).find((i: ContentItem) => i.id === selectedId)

  function parseReview(item: ContentItem): ReviewScores | null {
    const review = item.ai_review
    if (!review) return null
    try {
      return typeof review === 'string' ? JSON.parse(review) as ReviewScores : review as ReviewScores
    } catch { return null }
  }

  async function handleAiReview(id: string) {
    setIsReviewing(true)
    setError('')
    try {
      const item = items.find((i: any) => i.id === id) as ContentItem
      if (!item) throw new Error('Item not found')
      
      const idea = item.idea_id ? { title: item.title, content: item.body } : null
      const context = idea ? `Related idea title: ${idea.title}\n\n` : ''
      
      const result = await lemmaClient.agents.run('reviewer',
        `Please review this content item:\n\n${context}Title: ${item.title || 'Untitled'}\nType: ${item.content_type || 'content'}\nBody:\n${item.body || ''}\n\nEvaluate and return JSON with scores.`
      )
      
      const responseText = typeof result === 'string' ? result : 
        (result as any)?.response || (result as any)?.text || JSON.stringify(result)
      
      // Try to extract JSON from response
      let scores: ReviewScores = {}
      try {
        const jsonMatch = responseText.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          scores = JSON.parse(jsonMatch[0]) as ReviewScores
        }
      } catch {}
      
      // Calculate overall score
      const dims = ['grammar', 'clarity', 'readability', 'engagement', 'seo'] as const
      const validScores = dims.map(d => scores[d]).filter((s): s is number => s != null && s > 0)
      const overallScore = validScores.length > 0 
        ? validScores.reduce((a, b) => a + b, 0) / validScores.length
        : 0.7
      
      // Auto-approve if score >= 0.7
      const approved = overallScore >= 0.7
      scores.approved = approved
      scores.overall_score = overallScore
      
      // Save review results
      await updateItem.mutateAsync({
        tableName: 'content_items',
        recordId: id,
        payload: {
          ai_review: JSON.stringify(scores),
          ai_score: overallScore,
          status: approved ? 'approved' : 'review',
        }
      })
      
      setReviewResult({
        message: approved 
          ? `✅ Score ${(overallScore * 100).toFixed(0)}% — Auto-approved!` 
          : `⚠️ Score ${(overallScore * 100).toFixed(0)}% — Below threshold (70%)`,
        scores,
      })
      refresh()
      notifyTableChanged('content_items')
    } catch (err) {
      console.error('AI Review failed:', err)
      setError(`Review failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setIsReviewing(false)
    }
  }

  async function handleApprove(id: string) {
    const existing = parseReview(selected!)
    
    await updateItem.mutateAsync({
      tableName: 'content_items',
      recordId: id,
      payload: { 
        status: 'approved'
      }
    })
    setSelectedId(null)
    setReviewResult(null)
    refresh()
    notifyTableChanged('content_items')
  }

  async function handleReject(id: string, reason = 'Sent back for revision') {
    await updateItem.mutateAsync({
      tableName: 'content_items',
      recordId: id,
      payload: { status: 'draft' }
    })
    setSelectedId(null)
    setReviewResult(null)
    refresh()
    notifyTableChanged('content_items')
  }

  async function handleSendToQueue(id: string) {
    await updateItem.mutateAsync({
      tableName: 'content_items',
      recordId: id,
      payload: { status: 'scheduled' }
    })
    setSelectedId(null)
    setReviewResult(null)
    refresh()
    notifyTableChanged('content_items')
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Review</h1>
          <p>AI-powered review of your content drafts</p>
        </div>
      </div>

      <div className="grid-2">
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--line)', fontWeight: 600, fontSize: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Items to Review ({reviewItems.length})</span>
            <span style={{ fontSize: 12, color: 'var(--ink-muted)' }}>Click to inspect</span>
          </div>
          {isLoading ? (
            <div style={{ padding: 16 }}>
              <div className="skeleton" style={{ height: 40, marginBottom: 8 }} />
              <div className="skeleton" style={{ height: 40 }} />
            </div>
          ) : reviewItems.length === 0 ? (
            <div className="empty-state" style={{ padding: 24 }}>
              <CheckSquare size={32} />
              <h3>No items to review</h3>
              <p>Move content to "review" status to have it reviewed here</p>
            </div>
          ) : (
            <div>
              {reviewItems.map((item: ContentItem) => {
                const review = parseReview(item)
                return (
                  <div key={item.id}
                    style={{
                      padding: '12px 16px', borderBottom: '1px solid var(--line-subtle)',
                      cursor: 'pointer', background: selectedId === item.id ? 'var(--accent-lighter)' : undefined
                    }}
                    onClick={() => { setSelectedId(item.id); setReviewResult(null); setError('') }}>
                    <div style={{ fontWeight: 500, fontSize: 13.5 }}>{item.title || 'Untitled'}</div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 4, alignItems: 'center' }}>
                      <span className="tag">{item.content_type || 'content'}</span>
                      {review?.overall_score != null && (
                        <span className={`badge ${(review.overall_score || 0) >= 0.7 ? 'badge-approved' : 'badge-draft'}`}>
                          {Math.round((review.overall_score || 0) * 100)}%
                        </span>
                      )}
                      {!review && item.ai_score != null && item.ai_score > 0 && (
                        <span className={`badge ${item.ai_score >= 0.7 ? 'badge-approved' : 'badge-draft'}`}>
                          {Math.round(item.ai_score * 100)}%
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div>
          {selected ? (
            <div className="card">
              <div className="card-header">
                <div className="card-title">{selected.title || 'Untitled'}</div>
              </div>
              <div className="tag-group" style={{ marginBottom: 12 }}>
                <span className="tag">{selected.content_type || 'content'}</span>
                <span className="badge badge-review">review</span>
              </div>

              <div style={{ marginBottom: 16 }}>
                <h4 style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--ink-secondary)' }}>Content Preview</h4>
                <div style={{ background: 'var(--bg)', borderRadius: 'var(--radius-sm)', padding: 12, fontSize: 13, maxHeight: 200, overflowY: 'auto', whiteSpace: 'pre-wrap' }}>
                  {typeof selected.body === 'string' ? selected.body.substring(0, 1000) : 'No content body'}
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <h4 style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--ink-secondary)' }}>AI Review Scores</h4>
                {(() => {
                  const review = parseReview(selected)
                  if (review) {
                    return (
                      <div>
                        <div className="grid-2" style={{ gap: 8, marginBottom: 8 }}>
                          {(['grammar', 'clarity', 'readability', 'engagement', 'seo'] as const).map(metric => {
                            const score = review[metric]
                            if (score == null) return null
                            return (
                              <div key={metric} style={{ background: 'var(--bg)', borderRadius: 'var(--radius-sm)', padding: '8px 12px' }}>
                                <div style={{ fontSize: 11, color: 'var(--ink-muted)', textTransform: 'capitalize' }}>{metric}</div>
                                <div className={`score-ring ${score >= 0.7 ? 'score-high' : score >= 0.4 ? 'score-mid' : 'score-low'}`}
                                  style={{ width: 36, height: 36, fontSize: 11, marginTop: 4 }}>
                                  {Math.round(score * 100)}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                        {review.notes && (
                          <div style={{ background: 'var(--bg)', borderRadius: 'var(--radius-sm)', padding: 12, fontSize: 13, color: 'var(--ink-secondary)', marginTop: 8 }}>
                            <strong>Notes:</strong> {review.notes}
                          </div>
                        )}
                        {review.suggestions && review.suggestions.length > 0 && (
                          <div style={{ marginTop: 8 }}>
                            <strong style={{ fontSize: 13 }}>Suggestions:</strong>
                            <ul style={{ paddingLeft: 16, marginTop: 4 }}>
                              {review.suggestions.map((s: string, i: number) => (
                                <li key={i} style={{ fontSize: 12, color: 'var(--ink-secondary)' }}>{s}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {review.overall_score != null && (
                          <div style={{ marginTop: 12, padding: '8px 12px', background: review.overall_score >= 0.7 ? '#f0fdf4' : '#fef2f2', borderRadius: 'var(--radius-sm)' }}>
                            <strong>Overall: {Math.round(review.overall_score * 100)}%</strong>
                            {review.overall_score >= 0.7 ? ' ✓ Approved' : ' ✗ Needs revision'}
                          </div>
                        )}
                      </div>
                    )
                  }
                  return (
                    <div style={{ background: 'var(--bg)', borderRadius: 'var(--radius-sm)', padding: 16, textAlign: 'center', color: 'var(--ink-muted)', fontSize: 13 }}>
                      <button className="btn btn-primary" onClick={() => handleAiReview(selected.id)} disabled={isReviewing}
                        style={{ marginBottom: 8 }}>
                        <Sparkles size={14} /> {isReviewing ? 'Reviewing...' : 'Run AI Review'}
                      </button>
                      <p style={{ fontSize: 12 }}>AI will evaluate grammar, clarity, readability, engagement, and SEO</p>
                    </div>
                  )
                })()}
              </div>

              {error && (
                <div style={{ padding: '8px 12px', background: '#fef2f2', color: '#dc2626', fontSize: 13, borderRadius: 'var(--radius-sm)', marginBottom: 12 }}>
                  {error}
                </div>
              )}

              {reviewResult && (
                <div style={{ marginBottom: 12, padding: '8px 12px', background: reviewResult.scores?.approved ? '#f0fdf4' : '#fffbeb', borderRadius: 'var(--radius-sm)', fontSize: 13 }}>
                  {reviewResult.message}
                </div>
              )}

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button className="btn btn-primary" onClick={() => handleApprove(selected.id)}>
                  <CheckCircle size={14} /> Approve
                </button>
                <button className="btn" onClick={() => handleReject(selected.id)}>
                  <XCircle size={14} /> Send Back
                </button>
                <button className="btn" onClick={() => handleSendToQueue(selected.id)}>
                  <Send size={14} /> Schedule
                </button>
              </div>
            </div>
          ) : (
            <div className="card">
              <div className="empty-state">
                <CheckSquare size={32} />
                <h3>Select an item</h3>
                <p>Choose a content item from the list to review</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
