'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { BLOG_CATEGORIES } from '@/lib/blog'

const card = { background: '#fff', border: '1px solid var(--color-border)', borderRadius: 12, padding: 20, boxShadow: '0 1px 2px rgba(28,25,23,0.04)' }
const sectionTitle = { font: '600 12px Inter,sans-serif', letterSpacing: 1, textTransform: 'uppercase', color: '#9B9390', margin: '0 0 6px' }
const btnPrimary = { background: '#3B5249', color: '#fff', border: 'none', borderRadius: 6, padding: '10px 18px', font: '600 13px Inter,sans-serif', cursor: 'pointer' }
const btnGhost = (active) => ({
  padding: '9px 16px', borderRadius: 999, border: '1px solid ' + (active ? '#3B5249' : 'var(--color-border)'),
  background: active ? '#3B5249' : '#fff', color: active ? '#fff' : '#1C1917', font: '500 12px Inter,sans-serif', cursor: 'pointer', whiteSpace: 'nowrap',
})

export default function BlogListClient({ initialPosts }) {
  const router = useRouter()
  const [posts, setPosts] = useState(initialPosts)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [status, setStatus] = useState('')
  const [sort, setSort] = useState('newest')

  const stats = useMemo(() => ({
    total: posts.length,
    published: posts.filter(p => p.is_published).length,
    drafts: posts.filter(p => !p.is_published).length,
    featured: posts.filter(p => p.is_featured).length,
  }), [posts])

  const filtered = useMemo(() => {
    let list = posts.filter(p => {
      if (search && !`${p.title} ${p.category}`.toLowerCase().includes(search.toLowerCase())) return false
      if (category && p.category !== category) return false
      if (status === 'published' && !p.is_published) return false
      if (status === 'draft' && p.is_published) return false
      return true
    })
    list = [...list].sort((a, b) => sort === 'newest'
      ? new Date(b.publish_date) - new Date(a.publish_date)
      : new Date(a.publish_date) - new Date(b.publish_date))
    return list
  }, [posts, search, category, status, sort])

  const toggleFeatured = async (post) => {
    const res = await fetch(`/api/admin/blog/${post.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_featured: !post.is_featured }),
    })
    if (res.ok) {
      const { post: updated } = await res.json()
      setPosts(prev => prev.map(p => p.id === updated.id ? updated : p))
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this post? This cannot be undone.')) return
    const res = await fetch(`/api/admin/blog/${id}`, { method: 'DELETE' })
    if (res.ok) setPosts(prev => prev.filter(p => p.id !== id))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 14 }}>
        <div style={card}><div style={sectionTitle}>Total Posts</div><div style={{ font: '400 30px Cormorant Garamond,serif', color: '#1C1917' }}>{stats.total}</div></div>
        <div style={card}><div style={sectionTitle}>Published</div><div style={{ font: '400 30px Cormorant Garamond,serif', color: '#3B5249' }}>{stats.published}</div></div>
        <div style={card}><div style={sectionTitle}>Drafts</div><div style={{ font: '400 30px Cormorant Garamond,serif', color: '#9B9390' }}>{stats.drafts}</div></div>
        <div style={card}><div style={sectionTitle}>Featured</div><div style={{ font: '400 30px Cormorant Garamond,serif', color: '#C4924A' }}>{stats.featured}</div></div>
      </div>

      <div style={{ ...card, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <input className="input" placeholder="Search title, excerpt…" value={search} onChange={e => setSearch(e.target.value)} style={{ flex: '1 1 220px', minWidth: 180 }} />
        <select className="input" value={category} onChange={e => setCategory(e.target.value)} style={{ width: 'auto' }}>
          <option value="">All categories</option>
          {BLOG_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className="input" value={status} onChange={e => setStatus(e.target.value)} style={{ width: 'auto' }}>
          <option value="">All statuses</option>
          <option value="published">Published</option>
          <option value="draft">Draft</option>
        </select>
        <select className="input" value={sort} onChange={e => setSort(e.target.value)} style={{ width: 'auto' }}>
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
        </select>
        <button onClick={() => router.push('/dashboard/blog/new')} style={btnPrimary}>+ New post</button>
      </div>

      <div style={card}>
        {filtered.length === 0 ? (
          <p style={{ color: '#9B9390', font: '400 13px Inter,sans-serif' }}>No posts found.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', color: '#9B9390', font: '600 10px Inter,sans-serif', letterSpacing: 1, textTransform: 'uppercase' }}>
                <th style={{ padding: '6px 8px 10px' }}>Post</th>
                <th style={{ padding: '6px 8px 10px' }}>Category</th>
                <th style={{ padding: '6px 8px 10px' }}>Date</th>
                <th style={{ padding: '6px 8px 10px' }}>Read</th>
                <th style={{ padding: '6px 8px 10px' }}>Status</th>
                <th style={{ padding: '6px 8px 10px' }}>Feat.</th>
                <th style={{ padding: '6px 8px 10px' }}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id} style={{ borderTop: '1px solid #F0ECE6' }}>
                  <td style={{ padding: '10px 8px', cursor: 'pointer' }} onClick={() => router.push(`/dashboard/blog/${p.id}`)}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ position: 'relative', width: 56, height: 42, borderRadius: 6, overflow: 'hidden', flexShrink: 0, background: '#F0ECE6' }}>
                        {p.cover_image_url && <Image src={p.cover_image_url} alt="" fill sizes="56px" style={{ objectFit: 'cover' }} />}
                      </div>
                      <div style={{ font: '600 13px Inter,sans-serif', color: '#1C1917' }}>{p.title}</div>
                    </div>
                  </td>
                  <td style={{ padding: '10px 8px' }}>
                    <span style={{ background: '#EFE6D8', color: '#8C6D4F', padding: '3px 10px', borderRadius: 999, font: '600 10px Inter,sans-serif' }}>{p.category}</span>
                  </td>
                  <td style={{ padding: '10px 8px', font: '400 13px Inter,sans-serif', color: '#6B6663' }}>{new Date(p.publish_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                  <td style={{ padding: '10px 8px', font: '400 13px Inter,sans-serif', color: '#6B6663' }}>{p.read_time_minutes ? `${p.read_time_minutes} min read` : '—'}</td>
                  <td style={{ padding: '10px 8px' }}>
                    <span style={{
                      background: (p.is_published ? '#3B5249' : '#9B9390') + '1A', color: p.is_published ? '#3B5249' : '#9B9390',
                      padding: '3px 10px', borderRadius: 999, font: '600 10px Inter,sans-serif',
                    }}>{p.is_published ? 'PUBLISHED' : 'DRAFT'}</span>
                  </td>
                  <td style={{ padding: '10px 8px' }}>
                    <button onClick={() => toggleFeatured(p)} title={p.is_featured ? 'Unfeature' : 'Feature'} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: p.is_featured ? '#C4924A' : '#D8D2C8' }}>★</button>
                  </td>
                  <td style={{ padding: '10px 8px', whiteSpace: 'nowrap' }}>
                    <button onClick={() => router.push(`/dashboard/blog/${p.id}`)} style={{ ...btnGhost(false), padding: '6px 10px', marginRight: 6 }}>Edit</button>
                    <button onClick={() => handleDelete(p.id)} style={{ ...btnGhost(false), padding: '6px 10px', color: '#DC2626', borderColor: '#FCA5A5' }}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
