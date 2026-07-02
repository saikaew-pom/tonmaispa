'use client'

import { useState } from 'react'
import Image from 'next/image'
import { resizeImageForUpload } from '@/lib/resize-image'

const CLOUD_NAME    = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
const UPLOAD_PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET

export default function GalleryClient({ initialPhotos }) {
  const [photos, setPhotos]     = useState(initialPhotos)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(null) // { done, total }
  const [errors, setErrors]     = useState([])   // [{ fileName, message }]

  const uploadOne = async (file, sortOrder) => {
    const resized = await resizeImageForUpload(file)
    const formData = new FormData()
    formData.append('file', resized)
    formData.append('upload_preset', UPLOAD_PRESET)

    const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
      method: 'POST',
      body: formData,
    })
    const uploadData = await uploadRes.json()
    if (!uploadRes.ok) throw new Error(uploadData.error?.message || 'Cloudinary upload failed')

    const res = await fetch('/api/admin/gallery', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cloudinary_url: uploadData.secure_url, sort_order: sortOrder }),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body.error || 'Could not save photo record')
    }
    const { photo } = await res.json()
    return photo
  }

  const handleUpload = async (e) => {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    setErrors([])

    if (!CLOUD_NAME || !UPLOAD_PRESET) {
      setErrors([{ fileName: '', message: 'Cloudinary is not configured (missing cloud name or upload preset).' }])
      return
    }

    setUploading(true)
    setProgress({ done: 0, total: files.length })
    const newErrors = []

    // Sequential, not parallel — keeps sort_order correct and avoids
    // hammering Cloudinary with a burst of simultaneous uploads.
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      try {
        const photo = await uploadOne(file, photos.length + i)
        setPhotos(prev => [...prev, photo])
      } catch (err) {
        newErrors.push({ fileName: file.name, message: err.message })
      }
      setProgress({ done: i + 1, total: files.length })
    }

    setErrors(newErrors)
    setUploading(false)
    setProgress(null)
    e.target.value = ''
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
        {uploading ? `Uploading ${progress?.done ?? 0} of ${progress?.total ?? 0}…` : '+ Upload Photos'}
        <input type="file" accept="image/*" multiple onChange={handleUpload} disabled={uploading} style={{ display: 'none' }} />
      </label>
      {errors.length > 0 && (
        <div style={{ marginBottom: 12, background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 6, padding: '10px 14px' }}>
          {errors.map((e, i) => (
            <p key={i} style={{ color: '#DC2626', font: '400 13px Inter,sans-serif', margin: i === 0 ? 0 : '4px 0 0' }}>
              {e.fileName ? <strong>{e.fileName}:</strong> : null} {e.message}
            </p>
          ))}
        </div>
      )}

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
