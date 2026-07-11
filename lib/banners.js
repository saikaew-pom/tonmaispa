// Shared "which banner should a visitor see right now" logic — used by both
// the public /api/banners/active route and the dashboard preview. A banner
// is eligible when active and today falls inside its (optional) date window;
// among eligible banners, highest priority wins, so only one ever renders
// per visit (a stack of popups would be intrusive, not persuasive).
import { nowInSpaTz } from '@/lib/scheduling'

export async function getEligibleBanner(admin) {
  const { date: today } = nowInSpaTz()

  // Fetch active banners and filter the date window in JS rather than
  // chaining multiple .or() calls (ambiguous how PostgREST combines them) —
  // banner counts are small, so this is cheap and unambiguous.
  const { data } = await admin
    .from('banners')
    .select('id, name, message, image_url, cta_type, cta_label, cta_value, trigger_type, delay_seconds, start_date, end_date, priority, created_at, updated_at')
    .eq('is_active', true)
    .order('priority', { ascending: false })
    .order('created_at', { ascending: false })

  const eligible = (data ?? []).find(b =>
    (!b.start_date || b.start_date <= today) && (!b.end_date || b.end_date >= today)
  )
  return eligible ?? null
}
