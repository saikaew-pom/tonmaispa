import { requireAdmin } from '@/lib/require-admin'
import { generateDraft } from '@/lib/blog-ai'

// POST /api/admin/blog/generate-draft — { title, category } -> AI HTML body,
// grounded in real business facts pulled from the DB so it can't invent
// treatments, prices, or details that don't exist.
export async function POST(req) {
  const auth = await requireAdmin()
  if (auth.error) return Response.json({ error: auth.error }, { status: auth.status })

  const { title, category } = await req.json()
  if (!title || !category) {
    return Response.json({ error: 'Title and category are required' }, { status: 400 })
  }

  const [{ data: settingsRows }, { data: treatments }] = await Promise.all([
    auth.admin.from('site_content').select('key, value_text').eq('page', 'settings')
      .in('key', ['settings.whatsapp_number', 'settings.line_id', 'settings.opening_hours', 'settings.day_pass_price']),
    auth.admin.from('spa_treatments').select('name, category, prices').eq('is_active', true),
  ])
  const settings = Object.fromEntries((settingsRows ?? []).map(r => [r.key, r.value_text]))

  const context = {
    businessName: 'Ton Mai Spa',
    location: 'Rawai, Phuket, 5 minutes from Nai Harn Beach',
    openingHours: settings['settings.opening_hours'] || '09:00-23:00 daily',
    whatsapp: settings['settings.whatsapp_number'] || null,
    dayPassPrice: settings['settings.day_pass_price'] || null,
    treatments: (treatments ?? []).map(t => ({ name: t.name, category: t.category, prices: t.prices })),
    hasThermalCircuit: true,
    hasGardenRestaurant: true,
  }

  const draft = await generateDraft({ title, category, context })
  if (!draft) {
    return Response.json({ error: 'Could not generate a draft right now. Try again in a moment.' }, { status: 502 })
  }
  return Response.json({ body: draft })
}
