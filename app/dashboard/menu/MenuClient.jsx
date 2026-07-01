'use client'

import { useState } from 'react'

export default function MenuClient({ categories, initialItems }) {
  const [items, setItems] = useState(initialItems)
  const [activeCategory, setActiveCategory] = useState(categories[0]?.id ?? null)
  const [showNew, setShowNew] = useState(false)
  const [newItem, setNewItem] = useState({ name: '', price: '', description: '' })
  const [saving, setSaving] = useState(false)

  const visibleItems = items.filter(i => i.category_id === activeCategory)

  const handleCreate = async () => {
    setSaving(true)
    const res = await fetch('/api/admin/menu-items', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...newItem, price: newItem.price ? parseInt(newItem.price, 10) : null, category_id: activeCategory }),
    })
    if (res.ok) {
      const { item } = await res.json()
      setItems(prev => [...prev, item])
      setNewItem({ name: '', price: '', description: '' })
      setShowNew(false)
    }
    setSaving(false)
  }

  const handleUpdate = async (id, patch) => {
    const res = await fetch(`/api/admin/menu-items/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    if (res.ok) {
      const { item } = await res.json()
      setItems(prev => prev.map(i => i.id === id ? item : i))
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this menu item?')) return
    const res = await fetch(`/api/admin/menu-items/${id}`, { method: 'DELETE' })
    if (res.ok) setItems(prev => prev.filter(i => i.id !== id))
  }

  return (
    <div style={{ display: 'flex', gap: 20 }}>
      <div style={{ width: 200, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {categories.map(c => (
          <button key={c.id} onClick={() => setActiveCategory(c.id)} style={{
            textAlign: 'left', padding: '9px 12px', borderRadius: 4, border: 'none', cursor: 'pointer',
            background: activeCategory === c.id ? '#3B5249' : 'transparent',
            color: activeCategory === c.id ? '#fff' : '#1C1917',
            font: '500 13px Inter,sans-serif',
          }}>
            {c.name}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <button onClick={() => setShowNew(v => !v)} style={{ marginBottom: 16, background: '#3B5249', color: '#fff', border: 'none', borderRadius: 4, padding: '9px 16px', font: '600 12px Inter,sans-serif', cursor: 'pointer' }}>
          {showNew ? 'Cancel' : '+ Add Item'}
        </button>

        {showNew && (
          <div style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 8, padding: 16, marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 420 }}>
            <input className="input" placeholder="Item name" value={newItem.name} onChange={e => setNewItem(f => ({ ...f, name: e.target.value }))} />
            <input className="input" placeholder="Price (THB)" type="number" value={newItem.price} onChange={e => setNewItem(f => ({ ...f, price: e.target.value }))} />
            <input className="input" placeholder="Description (optional)" value={newItem.description} onChange={e => setNewItem(f => ({ ...f, description: e.target.value }))} />
            <button onClick={handleCreate} disabled={saving || !newItem.name} style={{ background: '#C4924A', color: '#fff', border: 'none', borderRadius: 4, padding: '9px 16px', font: '600 12px Inter,sans-serif', cursor: 'pointer' }}>
              {saving ? 'Saving…' : 'Add to Menu'}
            </button>
          </div>
        )}

        <div style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 8, overflow: 'hidden' }}>
          {visibleItems.length === 0 && (
            <div style={{ padding: 24, textAlign: 'center', color: '#9B9390', font: '400 13px Inter,sans-serif' }}>No items in this category yet.</div>
          )}
          {visibleItems.map((item, i) => (
            <MenuRow key={item.id} item={item} isLast={i === visibleItems.length - 1} onUpdate={patch => handleUpdate(item.id, patch)} onDelete={() => handleDelete(item.id)} />
          ))}
        </div>
      </div>
    </div>
  )
}

function MenuRow({ item, isLast, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(item.name)
  const [price, setPrice] = useState(item.price ?? '')

  const save = () => {
    onUpdate({ name, price: price ? parseInt(price, 10) : null })
    setEditing(false)
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: isLast ? 'none' : '1px solid #F0ECE6', opacity: item.is_active ? 1 : 0.5 }}>
      {editing ? (
        <>
          <input className="input" value={name} onChange={e => setName(e.target.value)} style={{ flex: 1 }} />
          <input className="input" type="number" value={price} onChange={e => setPrice(e.target.value)} style={{ width: 100 }} />
          <button onClick={save} style={{ background: '#3B5249', color: '#fff', border: 'none', borderRadius: 4, padding: '7px 12px', font: '500 11px Inter,sans-serif', cursor: 'pointer' }}>Save</button>
        </>
      ) : (
        <>
          <div style={{ flex: 1 }}>
            <div style={{ font: '600 13px Inter,sans-serif' }}>{item.name} {item.is_recommended && <span style={{ color: '#C4924A' }}>★</span>}</div>
            {item.description && <div style={{ font: '400 12px Inter,sans-serif', color: '#9B9390' }}>{item.description}</div>}
          </div>
          <div style={{ font: '600 13px Cormorant Garamond,serif', width: 60, textAlign: 'right' }}>{item.price ? `฿${item.price}` : '—'}</div>
          <button onClick={() => setEditing(true)} style={{ background: 'none', border: '1px solid var(--color-border)', borderRadius: 4, padding: '6px 10px', font: '500 11px Inter,sans-serif', cursor: 'pointer' }}>Edit</button>
        </>
      )}
      <button onClick={() => onUpdate({ is_active: !item.is_active })} style={{ background: 'none', border: '1px solid var(--color-border)', borderRadius: 4, padding: '6px 10px', font: '500 11px Inter,sans-serif', cursor: 'pointer' }}>
        {item.is_active ? 'Hide' : 'Show'}
      </button>
      <button onClick={onDelete} style={{ background: 'none', border: '1px solid #FCA5A5', color: '#DC2626', borderRadius: 4, padding: '6px 10px', font: '500 11px Inter,sans-serif', cursor: 'pointer' }}>Delete</button>
    </div>
  )
}
