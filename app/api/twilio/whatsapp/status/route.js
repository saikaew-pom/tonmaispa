import { createSupabaseAdminClient } from '@/lib/supabase-admin'
import { emptyTwimlResponse, parseAndValidateTwilioWebhook } from '@/lib/twilio'

export const runtime = 'nodejs'

const STATUS_RANK = {
  accepted: 1,
  scheduled: 1,
  queued: 2,
  sending: 3,
  sent: 4,
  delivered: 5,
  read: 6,
  undelivered: 7,
  failed: 7,
  canceled: 7,
}

export async function POST(request) {
  const webhook = await parseAndValidateTwilioWebhook(request)
  if (!webhook.valid) {
    return Response.json({ error: webhook.error }, { status: webhook.status })
  }

  const params = webhook.params
  const messageSid = params.MessageSid
  const nextStatus = params.MessageStatus
  if (!messageSid || !nextStatus) {
    return Response.json({ error: 'Incomplete Twilio status webhook' }, { status: 400 })
  }

  const admin = createSupabaseAdminClient()
  const eventKey = `status:${messageSid}:${nextStatus}`
  const { error: eventError } = await admin.from('twilio_webhook_events').insert({
    event_key: eventKey,
    event_type: 'message_status',
    twilio_sid: messageSid,
    payload: params,
    processing_status: 'received',
  })

  if (eventError?.code === '23505') return emptyTwimlResponse()
  if (eventError) {
    console.error('[twilio/status] failed to store webhook event:', eventError.message)
    return Response.json({ error: 'Could not record webhook' }, { status: 500 })
  }

  const { data: existing, error: readError } = await admin.from('twilio_messages')
    .select('status')
    .eq('twilio_message_sid', messageSid)
    .maybeSingle()

  if (readError) {
    console.error('[twilio/status] failed to read message:', readError.message)
    return Response.json({ error: 'Could not update message status' }, { status: 500 })
  }

  const currentRank = STATUS_RANK[existing?.status] || 0
  const nextRank = STATUS_RANK[nextStatus] || 0
  if (!existing || nextRank >= currentRank) {
    const timestamps = {}
    if (nextStatus === 'delivered') timestamps.delivered_at = new Date().toISOString()
    if (nextStatus === 'read') timestamps.read_at = new Date().toISOString()

    await admin.from('twilio_messages').upsert({
      twilio_message_sid: messageSid,
      direction: existing ? undefined : 'outbound',
      from_address: params.From || undefined,
      to_address: params.To || undefined,
      status: nextStatus,
      error_code: params.ErrorCode || null,
      error_message: params.ErrorMessage || null,
      raw_payload: params,
      updated_at: new Date().toISOString(),
      ...timestamps,
    }, { onConflict: 'twilio_message_sid' })

    await admin.from('conversation_messages')
      .update({ delivery_status: nextStatus, ...timestamps })
      .eq('twilio_message_sid', messageSid)
  }

  await admin.from('twilio_webhook_events')
    .update({ processing_status: 'stored', processed_at: new Date().toISOString() })
    .eq('event_key', eventKey)

  return emptyTwimlResponse()
}
