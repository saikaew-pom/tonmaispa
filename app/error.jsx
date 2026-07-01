'use client'

export default function Error({ error, reset }) {
  return (
    <main style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'var(--color-bg)', textAlign: 'center', padding: '2rem',
    }}>
      <p className="label" style={{ marginBottom: '1rem' }}>Something went wrong</p>
      <h2 style={{ fontFamily: 'var(--font-heading)', fontWeight: 300, marginBottom: '1rem' }}>
        We had a moment
      </h2>
      <p style={{ color: 'var(--color-text-mid)', marginBottom: '2rem', maxWidth: '40ch' }}>
        Please try again. If the issue continues, WhatsApp us at +66 63 117 5211.
      </p>
      <button onClick={reset} className="btn btn-primary">Try again</button>
    </main>
  )
}
