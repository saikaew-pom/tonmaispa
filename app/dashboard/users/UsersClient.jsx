'use client'

import { useState, useEffect } from 'react'

const card = { background: '#fff', border: '1px solid var(--color-border)', borderRadius: 12, padding: 20, boxShadow: '0 1px 2px rgba(28,25,23,0.04)' }
const sectionTitle = { font: '600 12px Inter,sans-serif', letterSpacing: 1, textTransform: 'uppercase', color: '#9B9390', margin: '0 0 14px' }
const btnPrimary = { background: '#3B5249', color: '#fff', border: 'none', borderRadius: 6, padding: '10px 18px', font: '600 13px Inter,sans-serif', cursor: 'pointer' }
const btnGhost = { padding: '6px 12px', borderRadius: 6, border: '1px solid var(--color-border)', background: '#fff', color: '#1C1917', font: '500 12px Inter,sans-serif', cursor: 'pointer' }
const ROLE_COLORS = { super_admin: '#C0392B', owner: '#C4924A', staff: '#3B5249' }

const GRANTABLE_ROLES = {
  super_admin: ['super_admin', 'owner', 'staff'],
  owner: ['staff'],
}

export default function UsersClient({ viewerRole }) {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [role, setRole] = useState(GRANTABLE_ROLES[viewerRole]?.[0] ?? 'staff')
  const [inviting, setInviting] = useState(false)
  const [inviteMessage, setInviteMessage] = useState('')

  const grantableRoles = GRANTABLE_ROLES[viewerRole] ?? []

  const loadUsers = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/users')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not load users')
      setUsers(data.users ?? [])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadUsers() }, [])

  const handleInvite = async (e) => {
    e.preventDefault()
    setInviting(true)
    setInviteMessage('')
    setError('')
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, fullName, role }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not send invite')
      setInviteMessage(`Invite sent to ${email}.`)
      setEmail('')
      setFullName('')
      loadUsers()
    } catch (e) {
      setError(e.message)
    } finally {
      setInviting(false)
    }
  }

  const toggleActive = async (user) => {
    setError('')
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !user.is_active }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not update user')
      setUsers(u => u.map(x => x.id === user.id ? { ...x, is_active: !user.is_active } : x))
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 720 }}>
      <div style={card}>
        <h2 style={sectionTitle}>Invite a new user</h2>
        <form onSubmit={handleInvite} style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: 1, minWidth: 160 }}>
            <label style={{ display: 'block', font: '500 12px Inter,sans-serif', color: '#4A4745', marginBottom: 4 }}>Full name</label>
            <input className="input" value={fullName} onChange={e => setFullName(e.target.value)} required />
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <label style={{ display: 'block', font: '500 12px Inter,sans-serif', color: '#4A4745', marginBottom: 4 }}>Email</label>
            <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          {grantableRoles.length > 1 && (
            <div>
              <label style={{ display: 'block', font: '500 12px Inter,sans-serif', color: '#4A4745', marginBottom: 4 }}>Role</label>
              <select className="input" value={role} onChange={e => setRole(e.target.value)}>
                {grantableRoles.map(r => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}
              </select>
            </div>
          )}
          <button type="submit" disabled={inviting} style={{ ...btnPrimary, opacity: inviting ? 0.7 : 1 }}>
            {inviting ? 'Sending…' : 'Send Invite'}
          </button>
        </form>
        {inviteMessage && <p style={{ color: '#065F46', font: '500 12px Inter,sans-serif', marginTop: 10 }}>{inviteMessage}</p>}
        {error && <p style={{ color: '#DC2626', font: '400 12px Inter,sans-serif', marginTop: 10 }}>{error}</p>}
      </div>

      <div style={card}>
        <h2 style={sectionTitle}>{viewerRole === 'owner' ? 'Staff accounts' : 'All accounts'}</h2>
        {loading && <p style={{ color: '#9B9390', font: '400 13px Inter,sans-serif' }}>Loading…</p>}
        {!loading && users.length === 0 && <p style={{ color: '#9B9390', font: '400 13px Inter,sans-serif' }}>No accounts yet.</p>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {users.map(u => (
            <div key={u.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #F0ECE6', borderRadius: 8, padding: 12 }}>
              <div>
                <div style={{ font: '600 13px Inter,sans-serif', color: '#1C1917' }}>
                  {u.full_name || '(no name)'}
                  <span style={{ marginLeft: 8, font: '600 9px Inter,sans-serif', letterSpacing: 1, textTransform: 'uppercase', color: ROLE_COLORS[u.role] ?? '#6B6663' }}>{u.role?.replace('_', ' ')}</span>
                  {!u.is_active && <span style={{ marginLeft: 8, font: '600 9px Inter,sans-serif', letterSpacing: 1, textTransform: 'uppercase', color: '#9B9390' }}>DEACTIVATED</span>}
                </div>
                <div style={{ font: '400 11px Inter,sans-serif', color: '#9B9390' }}>{u.email}</div>
              </div>
              {(viewerRole === 'super_admin' || u.role === 'staff') && (
                <button onClick={() => toggleActive(u)} style={btnGhost}>
                  {u.is_active ? 'Deactivate' : 'Reactivate'}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
