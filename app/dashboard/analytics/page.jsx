import AnalyticsClient from './AnalyticsClient'

export const dynamic = 'force-dynamic'

export default function AnalyticsPage() {
  return (
    <div>
      <h1 style={{ font: '400 32px Cormorant Garamond,serif', color: '#1C1917', margin: '0 0 8px' }}>Analytics</h1>
      <p style={{ font: '400 13px Inter,sans-serif', color: '#6B6663', margin: '0 0 24px' }}>
        Quick read on how the public site is doing — visitors, where they come from, and what they do.
      </p>
      <AnalyticsClient />
    </div>
  )
}
