'use client'

import { useState, useEffect } from 'react'
import { useRouter }           from 'next/navigation'
import { supabase }            from '@/lib/supabase'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword]   = useState('')
  const [confirm,  setConfirm]    = useState('')
  const [error,    setError]      = useState('')
  const [loading,  setLoading]    = useState(false)
  const [ready,    setReady]      = useState(false)

  useEffect(() => {
    // Supabase sends the token via URL hash — exchange it for a session
    supabase.auth.onAuthStateChange(async (event) => {
      if (event === 'PASSWORD_RECOVERY') setReady(true)
    })
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    setLoading(true)
    const { error: updateError } = await supabase.auth.updateUser({ password })

    if (updateError) {
      setError(updateError.message)
      setLoading(false)
      return
    }

    router.push('/dashboard')
  }

  if (!ready) {
    return (
      <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg)' }}>
        <p style={{ color: 'var(--color-text-muted)' }}>Verifying link…</p>
      </main>
    )
  }

  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg)', padding: '2rem' }}>
      <div style={{ width: '100%', maxWidth: '400px' }}>
        <p className="label" style={{ textAlign: 'center', marginBottom: '1.5rem' }}>Set New Password</p>
        <div style={{ background: 'var(--color-white)', borderRadius: 'var(--radius-lg)', padding: '2rem', boxShadow: 'var(--shadow-md)', border: '1px solid var(--color-border)' }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <input type="password" required value={password} onChange={e => setPassword(e.target.value)} className="input" placeholder="New password (min 8 chars)" />
            <input type="password" required value={confirm} onChange={e => setConfirm(e.target.value)} className="input" placeholder="Confirm password" />
            {error && <p style={{ color: '#DC2626', fontSize: '0.875rem' }}>{error}</p>}
            <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%', justifyContent: 'center' }}>
              {loading ? 'Saving…' : 'Set Password'}
            </button>
          </form>
        </div>
      </div>
    </main>
  )
}
