// Customer profile upsert — shared by every booking creation path (public
// site, admin dashboard, chatbot) so a customer is identified once, by
// phone number, regardless of which channel they booked through. This is
// the foundation the CRM (booking history, lifetime value, notes, and later
// WhatsApp identity/conversation linking per TWILIO_BOOKING_CRM_PLAN.md)
// builds on.

export async function upsertCustomer(admin, { name, phone, email }) {
  if (!phone) return null

  const { data: existing } = await admin
    .from('customers').select('id, display_name, email').eq('primary_phone_e164', phone).maybeSingle()

  if (existing) {
    // Fill in anything new the customer gave this time (a name typo fixed,
    // an email added later) without clobbering good data with a blank field.
    const updates = { last_contact_at: new Date().toISOString() }
    if (name && name !== existing.display_name) updates.display_name = name
    if (email && email !== existing.email) updates.email = email
    await admin.from('customers').update(updates).eq('id', existing.id)
    return existing.id
  }

  const now = new Date().toISOString()
  const { data: created, error } = await admin
    .from('customers')
    .insert({ display_name: name || 'Guest', primary_phone_e164: phone, email: email || null, last_contact_at: now })
    .select('id').single()
  if (error) {
    console.error('[customers] upsert failed:', error.message)
    return null
  }
  return created.id
}
