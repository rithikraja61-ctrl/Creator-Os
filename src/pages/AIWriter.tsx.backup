import { useState, useEffect } from 'react'
import { useRecords, useRecordCreate } from 'lemma-sdk/react'
import { lemmaClient } from '../lemma-client'
import { Sparkles, Lightbulb, Send, FileText, Copy, Check, RefreshCw, Save, Edit3 } from 'lucide-react'
import { notifyTableChanged, onTableChange } from '../lib/refresh-bus'

const CONTENT_TYPES = [
  { value: 'linkedin_post', label: 'LinkedIn Post' },
  { value: 'twitter_thread', label: 'Twitter/X Thread' },
  { value: 'blog_post', label: 'Blog Post' },
  { value: 'youtube_script', label: 'YouTube Script' },
  { value: 'newsletter', label: 'Newsletter' },
] as const

export function AIWriter() {
  const podId = lemmaClient.podId
  const [selectedIdea, setSelectedIdea] = useState('')
  const [contentType, setContentType] = useState('linkedin_post')
  const [generated, setGenerated] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [title, setTitle] = useState('')
  const [savedId, setSavedId] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editedContent, setEditedContent] = useState('')

  const { records: ideas, refresh: refreshIdeas } = useRecords({
    client: lemmaClient, podId, tableName: 'ideas', limit: 200,
    sort: [{ field: 'created_at', direction: 'desc' }],
    filters: [{ field: 'status', op: 'ne', value: 'archived' }]
  })

  // Auto-refresh ideas dropdown when ideas table changes
  useEffect(() => {
    const unsub = onTableChange('ideas', () => refreshIdeas())
    return unsub
  }, [refreshIdeas])

  const createContent = useRecordCreate(lemmaClient, podId)

  async function handleGenerate() {
    if (!selectedIdea && !title) return
    setIsGenerating(true)
    setError('')
    setSavedId(null)
    
    const idea = ideas.find((i: any) => i.id === selectedIdea)
    const context = idea 
      ? `Title: ${idea.title || ''}\n\nContent: ${idea.content || ''}`
      : `Topic: ${title}`

    try {
      // Call the writer agent
      const result = await lemmaClient.agents.run('writer', 
        `Generate a ${contentType} based on the following idea:\n\n${context}\n\nGenerate the content and save it as a draft in the content_items table. Return the generated content and the content_item_id.`
      )
      
      // Parse the agent response
      const responseText = typeof result === 'string' ? result : 
        (result as any)?.response || (result as any)?.text || JSON.stringify(result)
      
      setGenerated(responseText)
      setEditedContent(responseText)
      
      // Try to extract content_item_id from response
      const idMatch = responseText.match(/content_item_id[:\s]+([a-f0-9-]+)/i)
      if (idMatch) {
        setSavedId(idMatch[1])
      }
    } catch (err) {
      console.error('Generation failed:', err)
      setError(`Generation failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
      
      // Fallback: use template
      const fallback = `**${contentType}**\n\nBased on: ${context}\n\n---\n\nContent generation encountered an error. Please try again or use the template below.\n\n[Your content here]`
      setGenerated(fallback)
      setEditedContent(fallback)
    } finally {
      setIsGenerating(false)
    }
  }

  async function handleSaveAsDraft() {
    const content = isEditing ? editedContent : generated
    if (!content.trim()) return
    try {
      const record = await createContent.mutateAsync({
        tableName: 'content_items',
        payload: {
          title: title || 'Generated draft',
          content_type: contentType,
          body: content,
          idea_id: selectedIdea || null,
          status: 'draft',
          ai_score: 0,
          seo_score: 0,
        }
      })
      setSavedId((record as any).id || (record as any).recordId)
      notifyTableChanged('content_items')
    } catch (err) {
      console.error('Save failed:', err)
    }
  }

  async function handleSendToReview() {
    const content = isEditing ? editedContent : generated
    if (!content.trim() || !savedId) return
    try {
      await lemmaClient.functions.run('auto_tag', {
        input: { idea_id: savedId, title: title || 'Generated draft', content, source_type: contentType }
      })
    } catch {}
    // Send to review queue
    try {
      await lemmaClient.request('PATCH', `/pods/${podId}/tables/content_items/records/${savedId}`, {
        body: { data: { status: 'review' as const } }
      })
      notifyTableChanged('content_items')
    } catch {
      // Fallback: at least save as draft
      await handleSaveAsDraft()
    }
  }

  async function handleCopy() {
    const content = isEditing ? editedContent : generated
    await navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleRegenerate() {
    handleGenerate()
  }

  function toggleEdit() {
    if (isEditing) {
      setGenerated(editedContent)
    } else {
      setEditedContent(generated)
    }
    setIsEditing(!isEditing)
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>AI Writer</h1>
          <p>Generate content from your ideas using AI agents</p>
        </div>
      </div>

      <div className="writer-layout">
        <div className="writer-panel">
          <div className="card">
            <div className="card-header">
              <div className="card-title">Source</div>
            </div>
            <div className="form-group">
              <label className="form-label">Select an Idea</label>
              <select className="form-select" value={selectedIdea}
                onChange={e => {
                  setSelectedIdea(e.target.value)
                  const idea = ideas.find((i: any) => i.id === e.target.value)
                  if (idea) setTitle(String(idea.title || ""))
                }}>
                <option value="">— Select from inbox —</option>
                {ideas.map((idea: any) => (
                  <option key={idea.id} value={idea.id}>{idea.title || 'Untitled'}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Or enter a custom title / topic</label>
              <input className="form-input" type="text" value={title}
                placeholder="e.g., The Future of Remote Work"
                onChange={e => setTitle(e.target.value)} />
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <div className="card-title">Output Format</div>
            </div>
            <div className="form-group">
              <label className="form-label">Content Type</label>
              <select className="form-select" value={contentType}
                onChange={e => setContentType(e.target.value)}>
                {CONTENT_TYPES.map(ct => (
                  <option key={ct.value} value={ct.value}>{ct.label}</option>
                ))}
              </select>
            </div>
            <button className="btn btn-primary" onClick={handleGenerate} disabled={isGenerating || (!selectedIdea && !title.trim())}
              style={{ width: '100%', justifyContent: 'center' }}>
              <Sparkles size={16} />
              {isGenerating ? 'Generating...' : 'Generate Content'}
            </button>
          </div>
        </div>

        <div className="writer-panel">
          <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div className="card-header">
              <div className="card-title">
                {isEditing ? 'Edit Content' : 'Generated Content'}
                {savedId && <span style={{ fontSize: 11, color: 'var(--green)', marginLeft: 8 }}>Saved ✓</span>}
              </div>
              {generated && (
                <div style={{ display: 'flex', gap: 4 }}>
                  <button className="btn btn-sm btn-ghost" onClick={toggleEdit} title={isEditing ? 'Preview' : 'Edit'}>
                    <Edit3 size={14} />
                  </button>
                  <button className="btn btn-sm btn-ghost" onClick={handleCopy}>
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                  </button>
                  <button className="btn btn-sm btn-ghost" onClick={handleRegenerate} disabled={isGenerating}>
                    <RefreshCw size={14} />
                  </button>
                  <button className="btn btn-sm" onClick={handleSaveAsDraft} disabled={createContent.isPending}>
                    <Save size={14} /> Save
                  </button>
                  <button className="btn btn-sm btn-primary" onClick={handleSendToReview} disabled={!generated.trim()}>
                    <Send size={14} /> Review
                  </button>
                </div>
              )}
            </div>
            {error && (
              <div style={{ padding: '8px 16px', background: '#fef2f2', color: '#dc2626', fontSize: 13, borderBottom: '1px solid var(--line)' }}>
                {error}
              </div>
            )}
            {generated ? (
              isEditing ? (
                <textarea className="form-textarea" value={editedContent}
                  onChange={e => setEditedContent(e.target.value)}
                  style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: 13, minHeight: 400, border: 'none', borderRadius: 0, resize: 'vertical' }} />
              ) : (
                <div className="content-preview" style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: 13, whiteSpace: 'pre-wrap', padding: 16, overflow: 'auto' }}>
                  {generated}
                </div>
              )
            ) : (
              <div className="empty-state" style={{ flex: 1 }}>
                <Sparkles size={40} />
                <h3>Ready to create</h3>
                <p>Select an idea and content type, then generate</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
