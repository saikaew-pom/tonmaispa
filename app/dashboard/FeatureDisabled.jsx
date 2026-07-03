// Shown when a premium feature (Insights, Campaigns) is toggled off in
// Settings — blocks direct URL access, not just nav visibility.
export default function FeatureDisabled({ name }) {
  return (
    <div style={{
      background: '#fff', border: '1px solid var(--color-border)', borderRadius: 12,
      padding: 40, textAlign: 'center', maxWidth: 480, margin: '40px auto',
    }}>
      <div style={{ font: '400 20px Cormorant Garamond,serif', color: '#1C1917', marginBottom: 8 }}>{name} is not enabled</div>
      <p style={{ font: '400 13px/1.6 Inter,sans-serif', color: '#6B6663' }}>
        This is a premium feature. Ask an administrator to enable it from Settings → Feature Toggles.
      </p>
    </div>
  )
}
