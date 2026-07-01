import Link from 'next/link'

export const metadata = { title: 'Page Not Found' }

export default function NotFound() {
  return (
    <main style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'var(--color-bg)', textAlign: 'center',
      padding: '2rem',
    }}>
      <p className="label" style={{ marginBottom: '1rem' }}>404</p>
      <h1 style={{ fontFamily: 'var(--font-heading)', fontWeight: 300, marginBottom: '1rem' }}>
        Page not found
      </h1>
      <p style={{ color: 'var(--color-text-mid)', marginBottom: '2rem' }}>
        The page you are looking for does not exist or has been moved.
      </p>
      <Link href="/" className="btn btn-primary">Back to Ton Mai Spa</Link>
    </main>
  )
}
