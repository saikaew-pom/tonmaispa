import { createSupabaseAdminClient } from '@/lib/supabase-admin'
import GalleryClient from './GalleryClient'

export const dynamic = 'force-dynamic'

async function getData() {
  const admin = createSupabaseAdminClient()
  const { data } = await admin.from('gallery_photos').select('*').order('sort_order')
  return data ?? []
}

export default async function GalleryPage() {
  const photos = await getData()
  return (
    <div>
      <h1 style={{ font: '400 32px Cormorant Garamond,serif', color: '#1C1917', margin: '0 0 24px' }}>Gallery</h1>
      <GalleryClient initialPhotos={photos} />
    </div>
  )
}
