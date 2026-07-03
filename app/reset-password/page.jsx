'use client'

import { useState, useEffect } from 'react'
import { useRouter }           from 'next/navigation'
import { supabase }            from '@/lib/supabase'
import PasswordInput           from '@/components/ui/PasswordInput'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword]   = useState('')
  const [confirm,  setConfirm]    = useState('')
  const [error,    setError]      = useState('')
  const [loading,  setLoading]    = useState(false)
  const [ready,    setReady]      = useState(false)
  const [linkError, setLinkError] = useState('')

  useEffect(() => {
    let settled = false
    const markReady = () => { settled = true; setReady(true) }

    // Supabase Auth-js processes the URL's access token as soon as the client
    // is created — which can happen before this effect runs, so the
    // PASSWORD_RECOVERY event can fire and be missed entirely. Check for an
    // already-established session first (covers both recovery and invite
    // links — invite links land here too but fire SIGNED_IN, not
    // PASSWORD_RECOVERY), then keep listening for the event as a fallback
    // for the timing case where the session appears after mount.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) markReady()
    })

    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') markReady()
    })

    // If neither the session check nor the event fires within a few
    // seconds, the link is expired/invalid — show that instead of hanging
    // on "Verifying link..." forever.
    const timeout = setTimeout(() => {
      if (!settled) setLinkError('This link has expired or is invalid. Please ask an administrator to send a new one.')
    }, 6000)

    return () => {
      listener?.subscription?.unsubscribe()
      clearTimeout(timeout)
    }
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

  if (linkError) {
    return (
      <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg)', padding: '2rem' }}>
        <p style={{ color: '#DC2626', textAlign: 'center', maxWidth: 360 }}>{linkError}</p>
      </main>
    )
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
            <PasswordInput required value={password} onChange={e => setPassword(e.target.value)} placeholder="New password (min 8 chars)" autoComplete="new-password" />
            <PasswordInput required value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Confirm password" autoComplete="new-password" />
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
