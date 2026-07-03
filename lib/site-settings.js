// Shared reader for the `settings.*` keys stored in site_content (page='settings').
// Used by the dashboard layout (nav visibility), feature-gated pages, and
// their API routes, so all three read the same source of truth.

export async function getSettingsMap(admin, keys) {
  const { data } = await admin
    .from('site_content')
    .select('key, value_text')
    .eq('page', 'settings')
    .in('key', keys)
  return Object.fromEntries((data ?? []).map(r => [r.key, r.value_text]))
}

export async function isFeatureEnabled(admin, key) {
  const { data } = await admin
    .from('site_content')
    .select('value_text')
    .eq('key', key)
    .maybeSingle()
  return data?.value_text === 'true'
}
