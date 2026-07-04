// Guest profile upsert — shared by every booking creation path (public
// site, admin dashboard, chatbot) so a guest is identified once, by phone
// number, regardless of which channel they booked through. This is the
// foundation the CRM (booking history, lifetime value, notes) builds on.

export async function upsertGuest(admin, { name, phone, email }) {
  if (!phone) return null

  const { data: existing } = await admin
    .from('guests').select('id, full_name, email').eq('phone', phone).maybeSingle()

  if (existing) {
    // Fill in anything new the guest gave this time (a name typo fixed, an
    // email added later) without clobbering good data with a blank field.
    const updates = {}
    if (name && name !== existing.full_name) updates.full_name = name
    if (email && email !== existing.email) updates.email = email
    if (Object.keys(updates).length) {
      updates.updated_at = new Date().toISOString()
      await admin.from('guests').update(updates).eq('id', existing.id)
    }
    return existing.id
  }

  const { data: created, error } = await admin
    .from('guests').insert({ full_name: name || 'Guest', phone, email: email || null })
    .select('id').single()
  if (error) {
    console.error('[guests] upsert failed:', error.message)
    return null
  }
  return created.id
}
