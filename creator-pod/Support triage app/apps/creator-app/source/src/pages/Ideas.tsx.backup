import { useState, useRef, useEffect } from 'react'
import { useRecords, useRecordCreate, useRecordDelete, useRecordUpdate } from 'lemma-sdk/react'
import { lemmaClient } from '../lemma-client'
import { notifyTableChanged, onTableChange } from '../lib/refresh-bus'
import { Plus, Inbox, Link2, Upload, Twitter, FileText, MessageSquare, X, Search, Sparkles, Paperclip } from 'lucide-react'

export function Ideas() {
  const podId = lemmaClient.podId
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ title: '', content: '', source_type: 'manual', source_ref: '' })
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [uploadedFilePath, setUploadedFilePath] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisResult, setAnalysisResult] = useState<{tags: string[], summary: string} | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)

  const { records: ideas, isLoading, refresh } = useRecords({
    client: lemmaClient, podId, tableName: 'ideas', limit: 100,
    sort: [{ field: 'created_at', direction: 'desc' }]
  })

  // Auto-refresh when ideas table changes
  useEffect(() => {
    const unsub = onTableChange('ideas', () => refresh())
    return unsub
  }, [refresh])

  const createIdea = useRecordCreate(lemmaClient, podId)
  const deleteIdea = useRecordDelete(lemmaClient, podId)
  const updateIdea = useRecordUpdate(lemmaClient, podId)

  // ---- Helper: upload a file to Lemma Files ----
  async function uploadToLemma(file: File): Promise<string> {
    setIsUploading(true)
    try {
      const result = await lemmaClient.files.upload(file, {
        directoryPath: `/me/ideas`,
        searchEnabled: true,
      })
      // result contains a path or id — typically the path includes the file name
      const path = (result as any).path || `/me/ideas/${file.name}`
      return path
    } catch (err) {
      console.error('Upload failed:', err)
      throw err
    } finally {
      setIsUploading(false)
    }
  }

  // ---- Helper: fetch URL content via a simple proxy ----
  async function fetchUrlContent(url: string): Promise<string> {
    try {
      // Try direct fetch first (may fail CORS for many sites)
      const resp = await fetch(url, { mode: 'cors' })
      if (resp.ok) {
        const text = await resp.text()
        // Extract text from HTML
        const div = document.createElement('div')
        div.innerHTML = text
        const bodyText = div.textContent || div.innerText || ''
        return bodyText.substring(0, 5000).trim()
      }
    } catch {
      // CORS or network error — use stored URL as content
    }
    return `[URL: ${url}]\n\nContent could not be fetched automatically. Visit the URL to read the original content.`
  }

  // ---- Helper: run auto_tag function ----
  async function runAutoTag(ideaId: string, title: string, content: string, sourceType: string) {
    try {
      const result = await lemmaClient.functions.run('auto_tag', {
        input: { idea_id: ideaId, title, content, source_type: sourceType }
      })
      return result
    } catch (err) {
      console.error('Auto-tag failed:', err)
      return null
    }
  }

  // ---- Helper: generate embedding ----
  async function generateEmbedding(ideaId: string, text: string) {
    try {
      await lemmaClient.functions.run('generate_embedding', {
        input: { idea_id: ideaId, text }
      })
    } catch (err) {
      console.error('Embedding generation failed:', err)
    }
  }

  // ---- Submit handler ----
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim() && form.source_type !== 'screenshot' && form.source_type !== 'pdf') return

    setIsAnalyzing(true)
    let content = form.content
    let sourceRef = form.source_ref
    let filePath = uploadedFilePath

    // Handle source-type-specific processing
    if (form.source_type === 'url' && sourceRef) {
      content = await fetchUrlContent(sourceRef)
    }

    if ((form.source_type === 'screenshot' || form.source_type === 'pdf') && uploadedFile) {
      if (!filePath) {
        try {
          filePath = await uploadToLemma(uploadedFile)
        } catch {
          setIsAnalyzing(false)
          return
        }
      }
      content = content || `[${form.source_type === 'screenshot' ? 'Screenshot' : 'PDF'}: ${uploadedFile.name}]\nFile path: ${filePath}`
      sourceRef = filePath
    }

    if (form.source_type === 'tweet' && sourceRef) {
      content = content || `[Tweet from: ${sourceRef}]`
    }

    if (form.source_type === 'chat' && content) {
      // Parse chat transcript — extract messages and action items
      const lines = content.split('\n').filter(l => l.trim())
      const messages = lines.filter(l => /^[\w\s]+[:]\s/.test(l))
      content = `Chat Transcript\n\n${messages.join('\n')}\n\nFull transcript:\n${content}`
    }

    try {
      const payload: Record<string, unknown> = {
        title: form.title || `${form.source_type} idea`,
        content,
        source_type: form.source_type,
        source_ref: sourceRef || '',
        tags: '[]',
        status: 'inbox',
      }
      if (filePath) {
        payload.source_ref = filePath
      }

      const record = await createIdea.mutateAsync({
        tableName: 'ideas',
        payload,
      })

      const ideaId = (record as any).id || (record as any).recordId

      // Run AI analysis in background
      if (ideaId) {
        runAutoTag(ideaId, form.title || '', content, form.source_type)
          .then(result => {
            if (result) {
              const tags = (result as any).tags || []
              setAnalysisResult({ tags, summary: `Auto-tagged as: ${tags.join(', ')}` })
            }
          })
        generateEmbedding(ideaId, (form.title || '') + ' ' + content)
      }

      // Reset form
      setForm({ title: '', content: '', source_type: 'manual', source_ref: '' })
      setUploadedFile(null)
      setUploadedFilePath('')
      setShowModal(false)
      refresh()
      notifyTableChanged('ideas')
    } catch (err) {
      console.error('Failed to create idea:', err)
    } finally {
      setIsAnalyzing(false)
    }
  }

  // ---- File selection handler ----
  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) {
      setUploadedFile(file)
      if (!form.title) {
        setForm(f => ({ ...f, title: file.name.replace(/\.[^.]+$/, '') }))
      }
    }
  }

  // ---- Conditional UI for source types ----
  function renderSourceInputs() {
    switch (form.source_type) {
      case 'manual':
        return (
          <>
            <div className="form-group">
              <label className="form-label">Title</label>
              <input className="form-input" type="text" value={form.title}
                placeholder="Give your idea a title"
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required />
            </div>
            <div className="form-group">
              <label className="form-label">Notes</label>
              <textarea className="form-textarea" value={form.content}
                placeholder="Write your idea, note, or observation here..."
                onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                style={{ minHeight: 180 }} />
            </div>
          </>
        )

      case 'url':
        return (
          <>
            <div className="form-group">
              <label className="form-label">Title</label>
              <input className="form-input" type="text" value={form.title}
                placeholder="Auto-filled from URL or enter manually"
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">URL</label>
              <input className="form-input" type="url" value={form.source_ref}
                placeholder="https://example.com/article"
                onChange={e => setForm(f => ({ ...f, source_ref: e.target.value, title: f.title || e.target.value.replace(/^https?:\/\//, '').split('/')[0] }))} required />
            </div>
            <div className="form-group">
              <label className="form-label">Extracted Content (editable)</label>
              <textarea className="form-textarea" value={form.content}
                placeholder="Content will be auto-fetched when possible. You can also paste content manually."
                onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                style={{ minHeight: 120 }} />
            </div>
          </>
        )

      case 'bookmark':
        return (
          <>
            <div className="form-group">
              <label className="form-label">Title</label>
              <input className="form-input" type="text" value={form.title}
                placeholder="Bookmark title"
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required />
            </div>
            <div className="form-group">
              <label className="form-label">URL</label>
              <input className="form-input" type="url" value={form.source_ref}
                placeholder="https://example.com"
                onChange={e => setForm(f => ({ ...f, source_ref: e.target.value }))} required />
            </div>
            <div className="form-group">
              <label className="form-label">Notes</label>
              <textarea className="form-textarea" value={form.content}
                placeholder="Why are you bookmarking this?"
                onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                style={{ minHeight: 80 }} />
            </div>
          </>
        )

      case 'tweet':
        return (
          <>
            <div className="form-group">
              <label className="form-label">Title</label>
              <input className="form-input" type="text" value={form.title}
                placeholder="Tweet topic or idea"
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Tweet URL or Author handle</label>
              <input className="form-input" type="text" value={form.source_ref}
                placeholder="https://x.com/username/status/... or @username"
                onChange={e => setForm(f => ({ ...f, source_ref: e.target.value }))} required />
            </div>
            <div className="form-group">
              <label className="form-label">Content / Quotes</label>
              <textarea className="form-textarea" value={form.content}
                placeholder="Paste the tweet content or key quotes..."
                onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                style={{ minHeight: 120 }} />
            </div>
          </>
        )

      case 'chat':
        return (
          <>
            <div className="form-group">
              <label className="form-label">Title</label>
              <input className="form-input" type="text" value={form.title}
                placeholder="Chat topic or meeting name"
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required />
            </div>
            <div className="form-group">
              <label className="form-label">Chat Transcript</label>
              <textarea className="form-textarea" value={form.content}
                placeholder={'Paste chat transcript here...\n\nFormat: Messages with speaker names like:\nAlice: I think we should focus on the UI\nBob: Agreed, but let\'s also check the API'}
                onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                style={{ minHeight: 200 }} />
            </div>
          </>
        )

      case 'screenshot':
        return (
          <>
            <div className="form-group">
              <label className="form-label">Title</label>
              <input className="form-input" type="text" value={form.title}
                placeholder="Screenshot description"
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Upload Screenshot</label>
              <div className="upload-zone" onClick={() => imageInputRef.current?.click()}
                style={{
                  border: '2px dashed var(--line)', borderRadius: 8, padding: 24,
                  textAlign: 'center', cursor: 'pointer', background: uploadedFile ? 'var(--accent-lighter)' : 'var(--bg)'
                }}>
                {uploadedFile ? (
                  <div>
                    <Paperclip size={24} style={{ color: 'var(--accent)' }} />
                    <p style={{ fontWeight: 500, marginTop: 8 }}>{uploadedFile.name}</p>
                    <p style={{ fontSize: 12, color: 'var(--ink-muted)' }}>
                      {(uploadedFile.size / 1024).toFixed(0)} KB
                      {uploadedFilePath ? ' — Uploaded to Lemma Files' : ' — Ready to upload'}
                    </p>
                  </div>
                ) : (
                  <div>
                    <Upload size={24} style={{ color: 'var(--ink-muted)' }} />
                    <p style={{ marginTop: 8 }}>Click to select a screenshot</p>
                    <p style={{ fontSize: 12, color: 'var(--ink-muted)' }}>PNG, JPG, GIF up to 10MB</p>
                  </div>
                )}
                <input ref={imageInputRef} type="file" accept="image/*" style={{ display: 'none' }}
                  onChange={handleFileSelect} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Description (optional)</label>
              <textarea className="form-textarea" value={form.content}
                placeholder="What does this screenshot show?"
                onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                style={{ minHeight: 60 }} />
            </div>
          </>
        )

      case 'pdf':
        return (
          <>
            <div className="form-group">
              <label className="form-label">Title</label>
              <input className="form-input" type="text" value={form.title}
                placeholder="Document title"
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Upload PDF</label>
              <div className="upload-zone" onClick={() => fileInputRef.current?.click()}
                style={{
                  border: '2px dashed var(--line)', borderRadius: 8, padding: 24,
                  textAlign: 'center', cursor: 'pointer', background: uploadedFile ? 'var(--accent-lighter)' : 'var(--bg)'
                }}>
                {uploadedFile ? (
                  <div>
                    <FileText size={24} style={{ color: 'var(--accent)' }} />
                    <p style={{ fontWeight: 500, marginTop: 8 }}>{uploadedFile.name}</p>
                    <p style={{ fontSize: 12, color: 'var(--ink-muted)' }}>
                      {(uploadedFile.size / 1024).toFixed(0)} KB
                      {uploadedFilePath ? ' — Uploaded to Lemma Files' : ' — Ready to upload'}
                    </p>
                  </div>
                ) : (
                  <div>
                    <FileText size={24} style={{ color: 'var(--ink-muted)' }} />
                    <p style={{ marginTop: 8 }}>Click to select a PDF</p>
                    <p style={{ fontSize: 12, color: 'var(--ink-muted)' }}>PDF up to 20MB</p>
                  </div>
                )}
                <input ref={fileInputRef} type="file" accept=".pdf,application/pdf" style={{ display: 'none' }}
                  onChange={handleFileSelect} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Notes (optional)</label>
              <textarea className="form-textarea" value={form.content}
                placeholder="Any initial thoughts about this document?"
                onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                style={{ minHeight: 60 }} />
            </div>
          </>
        )

      default:
        return null
    }
  }

  const sourceIcons: Record<string, React.ReactNode> = {
    manual: <FileText size={14} />,
    url: <Link2 size={14} />,
    bookmark: <Link2 size={14} />,
    tweet: <Twitter size={14} />,
    chat: <MessageSquare size={14} />,
    screenshot: <Upload size={14} />,
    pdf: <FileText size={14} />,
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Idea Inbox</h1>
          <p>Capture and organize your creative ideas</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={16} /> New Idea
        </button>
      </div>

      {isLoading ? (
        <div className="card">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[1,2,3,4,5].map(i => <div key={i} className="skeleton" style={{ height: 48 }} />)}
          </div>
        </div>
      ) : ideas.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <Inbox size={40} />
            <h3>Your idea inbox is empty</h3>
            <p>Capture notes, URLs, screenshots, bookmarks, and more</p>
            <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => setShowModal(true)}>
              <Plus size={16} /> Capture your first idea
            </button>
          </div>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 30 }}></th>
                <th>Title</th>
                <th>Content</th>
                <th>Tags</th>
                <th>Status</th>
                <th>Source</th>
                <th style={{ width: 60 }}></th>
              </tr>
            </thead>
            <tbody>
              {ideas.map((idea: any) => (
                <tr key={idea.id}>
                  <td style={{ color: 'var(--ink-muted)' }}>
                    {sourceIcons[idea.source_type] || <FileText size={14} />}
                  </td>
                  <td style={{ fontWeight: 500 }}>{idea.title || 'Untitled'}</td>
                  <td style={{ maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--ink-muted)' }}>
                    {(idea.content || '').substring(0, 80)}{(idea.content || '').length > 80 ? '...' : ''}
                  </td>
                  <td>
                    <div className="tag-group">
                      {(() => {
                        try {
                          const tags = typeof idea.tags === 'string' ? JSON.parse(idea.tags) : idea.tags
                          return Array.isArray(tags) ? tags.slice(0, 3).map((t: string) => (
                            <span key={t} className="tag">{t}</span>
                          )) : null
                        } catch { return null }
                      })()}
                    </div>
                  </td>
                  <td><span className={`badge badge-${idea.status}`}>{idea.status}</span></td>
                  <td><span className="tag tag-sm">{idea.source_type}</span></td>
                  <td>
                    <button className="btn btn-sm btn-ghost" onClick={() => deleteIdea.mutateAsync({ tableName: 'ideas', recordId: idea.id }).then(() => { refresh(); notifyTableChanged('ideas') })}
                      style={{ color: 'var(--ink-muted)' }}>
                      <X size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Capture New Idea</div>
              <button className="btn btn-sm btn-ghost" onClick={() => setShowModal(false)}>
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Source Type</label>
                <div className="source-type-grid" style={{
                  display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 6
                }}>
                  {[
                    { value: 'manual', label: 'Note', icon: <FileText size={14} /> },
                    { value: 'url', label: 'URL', icon: <Link2 size={14} /> },
                    { value: 'bookmark', label: 'Bookmark', icon: <Paperclip size={14} /> },
                    { value: 'tweet', label: 'Tweet', icon: <Twitter size={14} /> },
                    { value: 'chat', label: 'Chat', icon: <MessageSquare size={14} /> },
                    { value: 'screenshot', label: 'Screenshot', icon: <Upload size={14} /> },
                    { value: 'pdf', label: 'PDF', icon: <FileText size={14} /> },
                  ].map(opt => (
                    <button key={opt.value} type="button"
                      className={`source-type-btn ${form.source_type === opt.value ? 'active' : ''}`}
                      onClick={() => setForm(f => ({ ...f, source_type: opt.value }))}
                      style={{
                        padding: '8px 10px', borderRadius: 6, border: `1px solid ${form.source_type === opt.value ? 'var(--accent)' : 'var(--line)'}`,
                        background: form.source_type === opt.value ? 'var(--accent-lighter)' : 'var(--bg)',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13
                      }}>
                      {opt.icon} {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {renderSourceInputs()}

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16, borderTop: '1px solid var(--line)', paddingTop: 16 }}>
                <button type="button" className="btn" onClick={() => {
                  setShowModal(false)
                  setUploadedFile(null)
                  setUploadedFilePath('')
                }}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={createIdea.isPending || isUploading || isAnalyzing}>
                  {isUploading ? 'Uploading file...' : isAnalyzing ? 'Analyzing...' : createIdea.isPending ? 'Saving...' : 'Save Idea'}
                </button>
              </div>

              {analysisResult && (
                <div className="card" style={{ marginTop: 12, padding: 12, background: 'var(--accent-lighter)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Sparkles size={14} style={{ color: 'var(--accent)' }} />
                    <span style={{ fontWeight: 500, fontSize: 13 }}>AI Analysis</span>
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--ink-secondary)', marginTop: 4 }}>{analysisResult.summary}</p>
                </div>
              )}
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
