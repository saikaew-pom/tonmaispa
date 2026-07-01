import { createSupabaseAdminClient } from '@/lib/supabase-admin'
import MenuClient from './MenuClient'

export const dynamic = 'force-dynamic'

async function getData() {
  const admin = createSupabaseAdminClient()
  const [catRes, itemRes] = await Promise.all([
    admin.from('menu_categories').select('id, name, type').order('sort_order'),
    admin.from('menu_items').select('*').order('sort_order'),
  ])
  return { categories: catRes.data ?? [], items: itemRes.data ?? [] }
}

export default async function MenuPage() {
  const { categories, items } = await getData()
  return (
    <div>
      <h1 style={{ font: '400 32px Cormorant Garamond,serif', color: '#1C1917', margin: '0 0 24px' }}>Restaurant Menu</h1>
      <MenuClient categories={categories} initialItems={items} />
    </div>
  )
}
