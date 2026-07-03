'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import PasswordInput from '@/components/ui/PasswordInput'

const card = { background: '#fff', border: '1px solid var(--color-border)', borderRadius: 12, padding: 20, boxShadow: '0 1px 2px rgba(28,25,23,0.04)' }
const sectionTitle = { font: '600 12px Inter,sans-serif', letterSpacing: 1, textTransform: 'uppercase', color: '#9B9390', margin: '0 0 14px' }
const btnPrimary = { background: '#3B5249', color: '#fff', border: 'none', borderRadius: 6, padding: '10px 18px', font: '600 13px Inter,sans-serif', cursor: 'pointer' }

export default function ProfileClient({ initialFullName, role, email }) {
  const [fullName, setFullName] = useState(initialFullName)
  const [savingName, setSavingName] = useState(false)
  const [nameSaved, setNameSaved] = useState(false)
  const [nameError, setNameError] = useState('')

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)
  const [passwordSaved, setPasswordSaved] = useState(false)
  const [passwordError, setPasswordError] = useState('')

  const saveName = async (e) => {
    e.preventDefault()
    setSavingName(true)
    setNameError('')
    setNameSaved(false)
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not save')
      setNameSaved(true)
    } catch (e) {
      setNameError(e.message)
    } finally {
      setSavingName(false)
    }
  }

  const savePassword = async (e) => {
    e.preventDefault()
    setPasswordError('')
    setPasswordSaved(false)

    if (password !== confirm) {
      setPasswordError('Passwords do not match.')
      return
    }
    if (password.length < 8) {
      setPasswordError('Password must be at least 8 characters.')
      return
    }

    setSavingPassword(true)
    const { error } = await supabase.auth.updateUser({ password })
    setSavingPassword(false)

    if (error) {
      setPasswordError(error.message)
      return
    }
    setPasswordSaved(true)
    setPassword('')
    setConfirm('')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 480 }}>
      <div style={card}>
        <h2 style={sectionTitle}>Account</h2>
        <div style={{ font: '400 13px Inter,sans-serif', color: '#4A4745', marginBottom: 4 }}>{email}</div>
        <div style={{ font: '400 12px Inter,sans-serif', color: '#9B9390', textTransform: 'capitalize' }}>{role?.replace('_', ' ')}</div>
      </div>

      <div style={card}>
        <h2 style={sectionTitle}>Display Name</h2>
        <form onSubmit={saveName} style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 180 }}>
            <input className="input" value={fullName} onChange={e => { setFullName(e.target.value); setNameSaved(false) }} required />
          </div>
          <button type="submit" disabled={savingName} style={{ ...btnPrimary, opacity: savingName ? 0.7 : 1 }}>
            {savingName ? 'Saving…' : 'Save'}
          </button>
        </form>
        {nameSaved && <p style={{ color: '#065F46', font: '500 12px Inter,sans-serif', marginTop: 10 }}>Saved ✓</p>}
        {nameError && <p style={{ color: '#DC2626', font: '400 12px Inter,sans-serif', marginTop: 10 }}>{nameError}</p>}
      </div>

      <div style={card}>
        <h2 style={sectionTitle}>Change Password</h2>
        <form onSubmit={savePassword} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <PasswordInput placeholder="New password (min 8 chars)" value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" required />
          <PasswordInput placeholder="Confirm new password" value={confirm} onChange={e => setConfirm(e.target.value)} autoComplete="new-password" required />
          <button type="submit" disabled={savingPassword} style={{ ...btnPrimary, opacity: savingPassword ? 0.7 : 1, alignSelf: 'flex-start' }}>
            {savingPassword ? 'Saving…' : 'Update Password'}
          </button>
        </form>
        {passwordSaved && <p style={{ color: '#065F46', font: '500 12px Inter,sans-serif', marginTop: 10 }}>Password updated ✓</p>}
        {passwordError && <p style={{ color: '#DC2626', font: '400 12px Inter,sans-serif', marginTop: 10 }}>{passwordError}</p>}
      </div>
    </div>
  )
}
