'use client'

import { useState, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { BLOG_CATEGORIES, slugify, estimateReadTime } from '@/lib/blog'
import { resizeImageForUpload } from '@/lib/resize-image'

const CLOUD_NAME    = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
const UPLOAD_PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET

const label = { display: 'block', font: '500 12px Inter,sans-serif', color: '#4A4745', marginBottom: 4 }
const sectionLabel = { font: '600 11px Inter,sans-serif', letterSpacing: 1.5, textTransform: 'uppercase', color: '#C4924A', margin: '0 0 14px', borderBottom: '1px solid var(--color-border)', paddingBottom: 8 }
const card = { background: '#fff', border: '1px solid var(--color-border)', borderRadius: 12, padding: 20, marginBottom: 16 }
const btnPrimary = { background: '#3B5249', color: '#fff', border: 'none', borderRadius: 6, padding: '10px 18px', font: '600 13px Inter,sans-serif', cursor: 'pointer' }
const btnGhost = { padding: '10px 16px', borderRadius: 6, border: '1px solid var(--color-border)', background: '#fff', color: '#1C1917', font: '500 13px Inter,sans-serif', cursor: 'pointer' }
const btnAi = { background: '#FAF3E8', color: '#8C6D4F', border: '1px solid #E8D5B7', borderRadius: 6, padding: '8px 14px', font: '600 12px Inter,sans-serif', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }

function emptyPost() {
  return {
    title: '', slug: '', category: BLOG_CATEGORIES[0], excerpt: '', cover_image_url: '', body: '',
    author_name: '', tags: [], publish_date: new Date().toISOString().slice(0, 10),
    read_time_minutes: null, is_published: false, is_featured: false,
  }
}

function ToggleSwitch({ checked, onChange }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
      style={{ width: 44, height: 24, borderRadius: 999, border: 'none', padding: 2, background: checked ? '#3B5249' : '#D8D2C8', cursor: 'pointer', display: 'flex', justifyContent: checked ? 'flex-end' : 'flex-start', transition: 'background 160ms ease', flexShrink: 0 }}>
      <span style={{ width: 20, height: 20, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.25)', display: 'block' }} />
    </button>
  )
}

function RichTextToolbar({ onCommand }) {
  const btn = { border: '1px solid var(--color-border)', background: '#fff', borderRadius: 4, padding: '5px 9px', font: '600 12px Inter,sans-serif', cursor: 'pointer', color: '#1C1917' }
  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', padding: '8px', borderBottom: '1px solid var(--color-border)', background: '#FAF9F6' }}>
      <button type="button" style={btn} onClick={() => onCommand('formatBlock', 'H2')}>H2</button>
      <button type="button" style={btn} onClick={() => onCommand('formatBlock', 'H3')}>H3</button>
      <button type="button" style={{ ...btn, fontWeight: 700 }} onClick={() => onCommand('bold')}>B</button>
      <button type="button" style={{ ...btn, fontStyle: 'italic' }} onClick={() => onCommand('italic')}>I</button>
      <button type="button" style={btn} onClick={() => onCommand('insertUnorderedList')}>••</button>
      <button type="button" style={btn} onClick={() => onCommand('insertOrderedList')}>1.</button>
      <button type="button" style={btn} onClick={() => onCommand('formatBlock', 'BLOCKQUOTE')}>&ldquo;&rdquo;</button>
      <button type="button" style={btn} onClick={() => {
        const url = prompt('Link URL:')
        if (url) onCommand('createLink', url)
      }}>Link</button>
      <button type="button" style={btn} onClick={() => onCommand('formatBlock', 'P')}>¶</button>
    </div>
  )
}

export default function BlogEditorClient({ initialPost, isNew }) {
  const router = useRouter()
  const [post, setPost] = useState(initialPost ? {
    ...initialPost,
    publish_date: initialPost.publish_date?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
    tags: initialPost.tags ?? [],
  } : emptyPost())
  const [slugTouched, setSlugTouched] = useState(!isNew)
  const [tagInput, setTagInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [generatingDraft, setGeneratingDraft] = useState(false)
  const [generatingExcerpt, setGeneratingExcerpt] = useState(false)
  const [error, setError] = useState('')
  const bodyRef = useRef(null)

  const set = (key, value) => setPost(p => ({ ...p, [key]: value }))

  const handleTitleChange = (value) => {
    set('title', value)
    if (!slugTouched) set('slug', slugify(value))
  }

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!CLOUD_NAME || !UPLOAD_PRESET) {
      setError('Cloudinary is not configured (missing cloud name or upload preset).')
      return
    }
    setUploading(true)
    setError('')
    try {
      const resized = await resizeImageForUpload(file)
      const formData = new FormData()
      formData.append('file', resized)
      formData.append('upload_preset', UPLOAD_PRESET)
      const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error?.message || 'Upload failed')
      set('cover_image_url', data.secure_url)
    } catch (err) {
      setError(err.message)
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const handleBodyInput = () => {
    if (bodyRef.current) set('body', bodyRef.current.innerHTML)
  }

  const runCommand = (command, value) => {
    document.execCommand(command, false, value)
    handleBodyInput()
    bodyRef.current?.focus()
  }

  const handleWriteWithAi = async () => {
    if (!post.title.trim()) { setError('Add a title first so AI knows what to write about.'); return }
    setGeneratingDraft(true)
    setError('')
    try {
      const res = await fetch('/api/admin/blog/generate-draft', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: post.title, category: post.category }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not generate a draft')
      if (bodyRef.current) bodyRef.current.innerHTML = data.body
      set('body', data.body)
      set('read_time_minutes', estimateReadTime(data.body))
    } catch (err) {
      setError(err.message)
    } finally {
      setGeneratingDraft(false)
    }
  }

  const handleGenerateExcerpt = async () => {
    if (!post.body || !post.body.trim()) { setError('Write (or generate) the article body first.'); return }
    setGeneratingExcerpt(true)
    setError('')
    try {
      const res = await fetch('/api/admin/blog/generate-excerpt', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: post.body }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not generate an excerpt')
      set('excerpt', data.excerpt)
    } catch (err) {
      setError(err.message)
    } finally {
      setGeneratingExcerpt(false)
    }
  }

  const addTag = () => {
    const t = tagInput.trim()
    if (t && !post.tags.includes(t)) set('tags', [...post.tags, t])
    setTagInput('')
  }
  const removeTag = (t) => set('tags', post.tags.filter(x => x !== t))

  const handleSave = async () => {
    if (!post.title.trim() || !post.excerpt.trim()) {
      setError('Title and excerpt are required.')
      return
    }
    setSaving(true)
    setError('')
    const payload = { ...post, slug: post.slug || slugify(post.title) }
    try {
      const res = isNew
        ? await fetch('/api/admin/blog', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        : await fetch(`/api/admin/blog/${post.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not save')
      router.push('/dashboard/blog')
      router.refresh()
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Delete this post? This cannot be undone.')) return
    const res = await fetch(`/api/admin/blog/${post.id}`, { method: 'DELETE' })
    if (res.ok) { router.push('/dashboard/blog'); router.refresh() }
  }

  const wordCount = useMemo(() => (post.body || '').replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length, [post.body])
  const readTime = post.read_time_minutes ?? estimateReadTime(post.body)

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'flex-start' }}>
      <div style={{ flex: '3 1 480px', minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <h1 style={{ font: '400 28px Cormorant Garamond,serif', color: '#1C1917', margin: 0 }}>{isNew ? 'New post' : 'Edit post'}</h1>
            <p style={{ font: '400 12px Inter,sans-serif', color: '#9B9390', margin: '4px 0 0' }}>{isNew ? 'Fill in the basics, then write or generate the body.' : (post.is_published ? 'Published — all fields auto-save on Save' : 'Draft')}</p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={handleWriteWithAi} disabled={generatingDraft} style={{ ...btnAi, opacity: generatingDraft ? 0.6 : 1 }}>
              {generatingDraft ? 'Writing…' : '★ Write with AI'}
            </button>
            <button onClick={() => router.push('/dashboard/blog')} style={{ ...btnGhost, padding: '10px 14px' }}>×</button>
          </div>
        </div>

        {error && <div style={{ ...card, background: '#FEF2F2', borderColor: '#FCA5A5', marginBottom: 16 }}><p style={{ color: '#DC2626', font: '400 13px Inter,sans-serif', margin: 0 }}>{error}</p></div>}

        <div style={card}>
          <h2 style={sectionLabel}>Basics</h2>
          <div style={{ marginBottom: 14 }}>
            <label style={label}>Title *</label>
            <input className="input" value={post.title} onChange={e => handleTitleChange(e.target.value)} placeholder="e.g. Top 5 Areas to Visit in Rawai" />
          </div>
          <div style={{ display: 'flex', gap: 14, marginBottom: 14 }}>
            <div style={{ flex: 1 }}>
              <label style={label}>Category</label>
              <select className="input" value={post.category} onChange={e => set('category', e.target.value)}>
                {BLOG_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={label}>URL slug</label>
              <input className="input" value={post.slug} onChange={e => { setSlugTouched(true); set('slug', e.target.value) }} />
            </div>
          </div>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={label}>Excerpt *</label>
              <button onClick={handleGenerateExcerpt} disabled={generatingExcerpt} style={{ ...btnAi, opacity: generatingExcerpt ? 0.6 : 1, padding: '5px 10px', fontSize: 11 }}>
                {generatingExcerpt ? 'Generating…' : '★ Generate with AI'}
              </button>
            </div>
            <textarea className="input" rows={3} style={{ resize: 'vertical' }} value={post.excerpt} onChange={e => set('excerpt', e.target.value)} placeholder="One or two sentences shown on the blog index" />
          </div>
        </div>

        <div style={card}>
          <h2 style={sectionLabel}>Cover Image</h2>
          {post.cover_image_url && (
            <div style={{ position: 'relative', marginBottom: 10, width: '100%', maxWidth: 320, height: 160, borderRadius: 6, overflow: 'hidden' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={post.cover_image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <button onClick={() => set('cover_image_url', '')} style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(28,25,23,0.6)', color: '#fff', border: 'none', borderRadius: '50%', width: 24, height: 24, cursor: 'pointer' }}>×</button>
            </div>
          )}
          <div style={{ border: '2px dashed var(--color-border)', borderRadius: 8, padding: 20, textAlign: 'center', marginBottom: 10 }}>
            <label style={{ cursor: 'pointer', display: 'block' }}>
              <div style={{ font: '600 13px Inter,sans-serif', color: '#1C1917', marginBottom: 4 }}>{uploading ? 'Uploading…' : 'Drop image or click to browse'}</div>
              <div style={{ font: '400 11px Inter,sans-serif', color: '#9B9390' }}>JPG, PNG, WEBP · max 10 MB</div>
              <input type="file" accept="image/*" onChange={handleImageUpload} disabled={uploading} style={{ display: 'none' }} />
            </label>
          </div>
          <label style={label}>Or paste a URL</label>
          <input className="input" value={post.cover_image_url?.startsWith('data:') ? '' : (post.cover_image_url || '')} onChange={e => set('cover_image_url', e.target.value)} placeholder="https://res.cloudinary.com/…/image.jpg" />
        </div>

        <div style={card}>
          <h2 style={sectionLabel}>Article Body</h2>
          <div style={{ border: '1px solid var(--color-border)', borderRadius: 8, overflow: 'hidden' }}>
            <RichTextToolbar onCommand={runCommand} />
            <div
              ref={bodyRef}
              contentEditable
              suppressContentEditableWarning
              onInput={handleBodyInput}
              dangerouslySetInnerHTML={{ __html: post.body || '' }}
              style={{ minHeight: 320, padding: 16, font: '400 15px/1.7 Inter,sans-serif', color: '#1C1917', outline: 'none' }}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, font: '400 11px Inter,sans-serif', color: '#9B9390' }}>
            <span>{wordCount} words</span>
            <span>~{readTime} min read</span>
          </div>
        </div>

        <div style={card}>
          <h2 style={sectionLabel}>Meta</h2>
          <div style={{ display: 'flex', gap: 14, marginBottom: 14 }}>
            <div style={{ flex: 1 }}>
              <label style={label}>Publish date</label>
              <input className="input" type="date" value={post.publish_date} onChange={e => set('publish_date', e.target.value)} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={label}>Read time</label>
              <input className="input" value={`${readTime} min read`} onChange={e => set('read_time_minutes', parseInt(e.target.value) || null)} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={label}>Author name</label>
              <input className="input" value={post.author_name || ''} onChange={e => set('author_name', e.target.value)} placeholder="Ton Mai Spa Team" />
            </div>
          </div>
          <div>
            <label style={label}>Tags</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, border: '1px solid var(--color-border)', borderRadius: 6, padding: 8 }}>
              {post.tags.map(t => (
                <span key={t} style={{ background: '#F0ECE6', borderRadius: 999, padding: '4px 10px', font: '500 12px Inter,sans-serif', display: 'flex', alignItems: 'center', gap: 6 }}>
                  {t}
                  <button onClick={() => removeTag(t)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9B9390' }}>×</button>
                </span>
              ))}
              <input
                value={tagInput} onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag() } }}
                placeholder="Add tag…" style={{ border: 'none', outline: 'none', flex: 1, minWidth: 100, font: '400 13px Inter,sans-serif' }}
              />
            </div>
          </div>
        </div>

        <div style={card}>
          <h2 style={sectionLabel}>Publishing</h2>
          <div style={{ display: 'flex', gap: 20 }}>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid var(--color-border)', borderRadius: 8, padding: 14 }}>
              <div>
                <div style={{ font: '600 13px Inter,sans-serif', color: '#1C1917' }}>Published</div>
                <div style={{ font: '400 11px Inter,sans-serif', color: '#9B9390' }}>Live on the Blog</div>
              </div>
              <ToggleSwitch checked={post.is_published} onChange={v => set('is_published', v)} />
            </div>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid var(--color-border)', borderRadius: 8, padding: 14 }}>
              <div>
                <div style={{ font: '600 13px Inter,sans-serif', color: '#1C1917' }}>Featured</div>
                <div style={{ font: '400 11px Inter,sans-serif', color: '#9B9390' }}>{post.is_featured ? 'Shown as hero on the index' : 'Standard post'}</div>
              </div>
              <ToggleSwitch checked={post.is_featured} onChange={v => set('is_featured', v)} />
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', bottom: 0, background: '#FAF6F0', padding: '14px 0' }}>
          {!isNew ? <button onClick={handleDelete} style={{ ...btnGhost, color: '#DC2626', borderColor: '#FCA5A5' }}>🗑 Delete post</button> : <span />}
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => router.push('/dashboard/blog')} style={btnGhost}>Cancel</button>
            <button onClick={handleSave} disabled={saving} style={{ ...btnPrimary, opacity: saving ? 0.7 : 1 }}>{saving ? 'Saving…' : '✓ Save changes'}</button>
          </div>
        </div>
      </div>

      {/* Live preview */}
      <div style={{ flex: '1 1 280px', minWidth: 260, position: 'sticky', top: 20 }}>
        <div style={{ font: '600 11px Inter,sans-serif', letterSpacing: 1.5, textTransform: 'uppercase', color: '#9B9390', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
          👁 Live Preview
        </div>
        <div style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 2px rgba(28,25,23,0.04)' }}>
          <div style={{ position: 'relative', height: 180, background: '#F0ECE6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {post.cover_image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={post.cover_image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <span style={{ color: '#9B9390', font: '400 12px Inter,sans-serif' }}>No cover yet</span>
            )}
          </div>
          <div style={{ padding: 20 }}>
            <div style={{ font: '600 10px Inter,sans-serif', letterSpacing: 1.5, textTransform: 'uppercase', color: '#C4924A', marginBottom: 6 }}>
              {post.category} · {post.publish_date ? new Date(post.publish_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''} · {readTime} min read
            </div>
            <h3 style={{ font: '400 22px Cormorant Garamond,serif', color: '#1C1917', margin: '0 0 10px' }}>{post.title || 'Untitled post'}</h3>
            <p style={{ font: '400 13px/1.6 Inter,sans-serif', color: '#6B6663', margin: 0 }}>{post.excerpt || 'Excerpt will appear here.'}</p>
            {post.author_name && (
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid #F0ECE6', font: '500 12px Inter,sans-serif', color: '#1C1917' }}>By {post.author_name}</div>
            )}
          </div>
        </div>
        <p style={{ font: '400 11px Inter,sans-serif', color: '#9B9390', marginTop: 10 }}>How the post appears on the blog index.</p>
      </div>
    </div>
  )
}
