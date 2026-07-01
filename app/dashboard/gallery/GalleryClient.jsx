'use client'

import { useState } from 'react'
import Image from 'next/image'

const CLOUD_NAME    = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
const UPLOAD_PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET

export default function GalleryClient({ initialPhotos }) {
  const [photos, setPhotos]     = useState(initialPhotos)
  const [uploading, setUploading] = useState(false)
  const [error, setError]       = useState('')

  const handleUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError('')

    if (!CLOUD_NAME || !UPLOAD_PRESET) {
      setError('Cloudinary is not configured.')
      return
    }

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('upload_preset', UPLOAD_PRESET)

      const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
        method: 'POST',
        body: formData,
      })
      const uploadData = await uploadRes.json()
      if (!uploadRes.ok) throw new Error(uploadData.error?.message || 'Upload failed')

      const res = await fetch('/api/admin/gallery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cloudinary_url: uploadData.secure_url, sort_order: photos.length }),
      })
      if (!res.ok) throw new Error('Could not save photo')
      const { photo } = await res.json()
      setPhotos(prev => [...prev, photo])
    } catch (err) {
      setError(err.message)
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const toggleFeatured = async (photo) => {
    const res = await fetch(`/api/admin/gallery/${photo.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ featured: !photo.featured }),
    })
    if (res.ok) setPhotos(prev => prev.map(p => p.id === photo.id ? { ...p, featured: !photo.featured } : p))
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this photo from the gallery?')) return
    const res = await fetch(`/api/admin/gallery/${id}`, { method: 'DELETE' })
    if (res.ok) setPhotos(prev => prev.filter(p => p.id !== id))
  }

  return (
    <div>
      <label style={{ display: 'inline-block', marginBottom: 16, background: '#3B5249', color: '#fff', border: 'none', borderRadius: 4, padding: '10px 18px', font: '600 12px Inter,sans-serif', cursor: 'pointer' }}>
        {uploading ? 'Uploading…' : '+ Upload Photo'}
        <input type="file" accept="image/*" onChange={handleUpload} disabled={uploading} style={{ display: 'none' }} />
      </label>
      {error && <p style={{ color: '#DC2626', font: '400 13px Inter,sans-serif', marginBottom: 12 }}>{error}</p>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 14 }}>
        {photos.map(photo => (
          <div key={photo.id} style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 8, overflow: 'hidden' }}>
            <div style={{ position: 'relative', height: 130 }}>
              <Image src={photo.cloudinary_url} alt={photo.alt_text ?? ''} fill sizes="200px" style={{ objectFit: 'cover' }} />
              {photo.featured && (
                <div style={{ position: 'absolute', top: 6, left: 6, background: '#C4924A', color: '#fff', padding: '2px 8px', borderRadius: 999, font: '600 9px Inter,sans-serif' }}>Featured</div>
              )}
            </div>
            <div style={{ padding: 8, display: 'flex', gap: 6 }}>
              <button onClick={() => toggleFeatured(photo)} style={{ flex: 1, background: 'none', border: '1px solid var(--color-border)', borderRadius: 4, padding: '6px 4px', font: '500 10px Inter,sans-serif', cursor: 'pointer' }}>
                {photo.featured ? 'Unfeature' : 'Feature'}
              </button>
              <button onClick={() => handleDelete(photo.id)} style={{ background: 'none', border: '1px solid #FCA5A5', color: '#DC2626', borderRadius: 4, padding: '6px 8px', font: '500 10px Inter,sans-serif', cursor: 'pointer' }}>
                Delete
              </button>
            </div>
          </div>
        ))}
        {photos.length === 0 && (
          <div style={{ gridColumn: '1/-1', padding: 24, textAlign: 'center', color: '#9B9390', font: '400 13px Inter,sans-serif' }}>No photos uploaded yet.</div>
        )}
      </div>
    </div>
  )
}
