// ============================================================
// TON MAI SPA — /api/chat
// MiniMax-M3 chatbot — streaming, server-side, tool-capable
// System prompt built live from Supabase data every request
// ============================================================

import { createSupabaseAdminClient } from '@/lib/supabase-admin'
import { getMiniMax, MINIMAX_MODEL }  from '@/lib/minimax'
import { checkRateLimit }             from '@/lib/ratelimit'
import { buildSystemPrompt, TOOLS_SIMPLE, TOOLS_FULL } from '@/lib/chatbot'
import { sendEmail, enquiryOwnerHtml, bookingGuestHtml, bookingOwnerHtml } from '@/lib/brevo'
import { getAvailableSlots, checkSlotCapacity } from '@/lib/scheduling'

export const maxDuration = 60

export async function POST(req) {
  // ── 1. Rate limit — 30 messages per 10 min per IP ──────────
  const rl = await checkRateLimit(req, 'chat', { limit: 30, window: 600 })
  if (!rl.success) {
    return Response.json({ error: 'Too many messages. Please wait a moment.' }, { status: 429 })
  }

  const body = await req.json()
  const { messages, sessionId } = body

  if (!messages?.length || !sessionId) {
    return Response.json({ error: 'Invalid request' }, { status: 400 })
  }

  const admin = createSupabaseAdminClient()

  // ── 2. Load live spa data for system prompt ─────────────────
  const [treatmentsRes, settingsRes] = await Promise.all([
    admin.from('spa_treatments').select('*').eq('is_active', true).order('sort_order'),
    admin.from('site_content').select('key, value_text').eq('page', 'settings'),
  ])

  const settings = Object.fromEntries(
    (settingsRes.data ?? []).map(r => [r.key, r.value_text])
  )
  // booking_engine_enabled is the master switch for the whole booking system;
  // chatbot_booking_mode ('simple' | 'full') decides whether the chatbot,
  // specifically, is allowed to check availability and create bookings
  // autonomously, or just captures a lead for staff follow-up. Both must be
  // true/'full' for the chatbot to get the full tool set.
  const bookingEngineEnabled = settings['settings.booking_engine_enabled'] === 'true'
  const chatbotFullMode = bookingEngineEnabled && settings['settings.chatbot_booking_mode'] === 'full'

  // ── 3. Build dynamic system prompt ─────────────────────────
  const systemPrompt = buildSystemPrompt({
    treatments: treatmentsRes.data ?? [],
    settings,
    bookingEngineEnabled: chatbotFullMode,
  })

  const tools = chatbotFullMode ? TOOLS_FULL : TOOLS_SIMPLE

  // ── 4. Call MiniMax with streaming ─────────────────────────
  const client = getMiniMax()
  if (!client) {
    return Response.json({ error: 'AI service unavailable' }, { status: 503 })
  }

  // Keep last 20 messages to manage token usage
  const trimmedMessages = messages.slice(-20)

  // ── 5. Stream response + run the tool-use loop ──────────────
  // Anthropic/MiniMax tool calling is a round-trip: the model emits a
  // tool_use block, we execute it, then we must send the result BACK to
  // the model in a follow-up call so it can write the actual answer.
  // Previously this route executed the tool and stopped — the model never
  // saw the result, so it just kept saying "let me check" / "one moment"
  // forever on every subsequent message. This loop keeps calling MiniMax
  // with the accumulated tool results appended until it produces a final
  // text answer (stop_reason !== 'tool_use'), capped at a few rounds.
  const encoder = new TextEncoder()
  const MAX_TOOL_ROUNDS = 4

  const readable = new ReadableStream({
    async start(controller) {
      let fullText = ''
      const conversationMessages = [...trimmedMessages]

      try {
        let resolvedNaturally = false

        for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
          const stream = await client.messages.create({
            model:      MINIMAX_MODEL,
            max_tokens: 500,
            system:     systemPrompt,
            messages:   conversationMessages,
            tools,
            stream:     true,
          })

          const blocks = {} // index -> accumulated content block
          let stopReason = null

          for await (const event of stream) {
            if (event.type === 'content_block_start') {
              const block = event.content_block
              blocks[event.index] = block.type === 'tool_use'
                ? { type: 'tool_use', id: block.id, name: block.name, inputJson: '' }
                : { type: 'text', text: '' }
            }

            if (event.type === 'content_block_delta') {
              const block = blocks[event.index]
              if (event.delta?.type === 'text_delta') {
                block.text += event.delta.text
                fullText += event.delta.text
                controller.enqueue(encoder.encode(
                  JSON.stringify({ type: 'text', text: event.delta.text }) + '\n'
                ))
              }
              if (event.delta?.type === 'input_json_delta') {
                block.inputJson += event.delta.partial_json ?? ''
              }
            }

            if (event.type === 'message_delta') {
              stopReason = event.delta?.stop_reason
            }
          }

          const assistantContent = Object.keys(blocks).sort((a, b) => a - b).map(i => {
            const b = blocks[i]
            if (b.type === 'tool_use') {
              let input = {}
              try { input = JSON.parse(b.inputJson || '{}') } catch {}
              return { type: 'tool_use', id: b.id, name: b.name, input }
            }
            return { type: 'text', text: b.text }
          })
          conversationMessages.push({ role: 'assistant', content: assistantContent })

          if (stopReason !== 'tool_use') {
            resolvedNaturally = true
            break
          }

          // Execute every tool_use block from this turn, then feed the
          // results back as a user turn so the next round can use them.
          const toolResultContent = []
          for (const block of assistantContent) {
            if (block.type !== 'tool_use') continue

            // executeToolCall's own `bookingEngineEnabled` guard is really asking
            // "is the chatbot allowed to check_availability/create_booking right
            // now" — that's chatbotFullMode, not the raw master switch.
            const toolResult = await executeToolCall(
              block.name,
              block.input,
              { admin, sessionId, bookingEngineEnabled: chatbotFullMode, settings }
            )

            controller.enqueue(encoder.encode(
              JSON.stringify({ type: 'tool_result', tool: block.name, result: toolResult }) + '\n'
            ))

            toolResultContent.push({ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify(toolResult) })
          }
          conversationMessages.push({ role: 'user', content: toolResultContent })
        }

        if (!resolvedNaturally) {
          const fallback = "I'm having trouble finishing that check — let me connect you with our team on WhatsApp."
          fullText += fallback
          controller.enqueue(encoder.encode(JSON.stringify({ type: 'text', text: fallback }) + '\n'))
        }

        // ── 6. Persist conversation to Supabase ────────────────
        await persistSession({ admin, sessionId, messages: trimmedMessages, assistantText: fullText })

      } catch (err) {
        console.error('[chat] stream error:', err)
        controller.enqueue(encoder.encode(
          JSON.stringify({ type: 'error', text: "I'm having a moment — please try again, or WhatsApp us directly." }) + '\n'
        ))
      } finally {
        controller.close()
      }
    },
  })

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'X-Accel-Buffering': 'no',
    },
  })
}

// ============================================================
// TOOL EXECUTION
// ============================================================

async function executeToolCall(toolName, input, { admin, sessionId, bookingEngineEnabled, settings }) {
  switch (toolName) {

    case 'update_guest_info': {
      const updates = {}
      if (input.guest_name)  updates.guest_name  = input.guest_name
      if (input.guest_phone) updates.guest_phone = input.guest_phone
      if (Object.keys(updates).length > 0) {
        await admin.from('chat_sessions')
          .update({ ...updates, last_active: new Date().toISOString() })
          .eq('session_id', sessionId)
      }
      return { ok: true }
    }

    case 'capture_booking_intent': {
      // Update session with guest info
      await admin.from('chat_sessions')
        .update({
          guest_name:  input.guest_name,
          guest_phone: input.guest_phone,
          last_active: new Date().toISOString(),
        })
        .eq('session_id', sessionId)

      // Save to enquiries table — staff will follow up via WhatsApp
      const { data: enquiry } = await admin.from('enquiries').insert({
        name:    input.guest_name,
        phone:   input.guest_phone,
        message: buildEnquiryMessage(input),
        source:  'chatbot',
        status:  'new',
        metadata: {
          treatment_interest: input.treatment_name,
          preferred_date:     input.preferred_date,
          preferred_time:     input.preferred_time,
          party_size:         input.party_size ?? 1,
          chat_session_id:    sessionId,
          notes:              input.notes,
        },
      }).select().single()

      // Notify staff — no guest email available in this flow, so guest
      // confirmation is skipped (they're told the team will WhatsApp them)
      if (process.env.INQUIRY_EMAIL) {
        await sendEmail({
          to:      process.env.INQUIRY_EMAIL,
          subject: `New enquiry from ${input.guest_name} (chatbot)`,
          html:    enquiryOwnerHtml({
            name:    input.guest_name,
            phone:   input.guest_phone,
            message: buildEnquiryMessage(input),
            source:  'chatbot',
          }),
        }).catch(err => console.error('[chat] enquiry email failed:', err))
      }

      return { ok: true, enquiry_id: enquiry?.id }
    }

    case 'check_availability': {
      if (!bookingEngineEnabled) return { ok: false, error: 'Booking engine is not active' }

      const { date, duration } = input
      const treatment = await resolveTreatment(admin, input)
      if (!treatment) return { ok: false, error: 'Unknown treatment — ask the guest which treatment from the menu they mean.' }

      // Same shared logic as the public /book page — therapist shifts,
      // qualifications, overlapping-duration bookings, and room capacity all
      // taken into account, so the chatbot can never over-promise a slot.
      const { slots, closed } = await getAvailableSlots(admin, {
        date, treatmentId: treatment.id, duration: duration ?? treatment.duration_options?.[0] ?? 60,
      })
      if (closed) return { ok: true, available: false, message: 'The spa is closed on this date.' }

      const openTimes = slots.filter(s => s.available).map(s => s.time)
      return {
        ok: true,
        available: openTimes.length > 0,
        treatment: treatment.name,
        date,
        open_times: openTimes,
        message: openTimes.length === 0
          ? 'Fully booked for this treatment on this date — suggest another date or a different treatment.'
          : undefined,
      }
    }

    case 'create_booking': {
      if (!bookingEngineEnabled) return { ok: false, error: 'Booking engine is not active' }

      const treatment = await resolveTreatment(admin, input)
      if (!treatment) return { ok: false, error: 'Unknown treatment — ask the guest which treatment from the menu they mean.' }

      // Validate capacity before inserting — the chatbot must never create a
      // booking no therapist/room can actually serve. Auto-assigns the
      // therapist(s) exactly like the public flow.
      const endTime = addMinutesStr(input.time_slot, input.duration)
      const capacity = await checkSlotCapacity(admin, {
        treatmentId: treatment.id, date: input.date, startTime: input.time_slot, endTime,
      })
      if (!capacity.ok) {
        const { slots } = await getAvailableSlots(admin, { date: input.date, treatmentId: treatment.id, duration: input.duration })
        const alternatives = slots.filter(s => s.available).map(s => s.time).slice(0, 6)
        return {
          ok: false,
          error: 'This slot is no longer available.',
          nearest_open_times: alternatives,
          hint: alternatives.length ? 'Offer the guest these times instead.' : 'Suggest a different date.',
        }
      }

      const price = treatment.prices?.[String(input.duration)] ?? null

      const { data: booking, error } = await admin.from('bookings').insert({
        guest_name:      input.guest_name,
        guest_phone:     input.guest_phone,
        guest_email:     input.guest_email,
        treatment_id:    treatment.id,
        therapist_id:    capacity.therapistIds[0],
        secondary_therapist_id: capacity.therapistIds[1] ?? null,
        date:            input.date,
        time_slot:       input.time_slot,
        duration:        input.duration,
        price,
        notes:           input.notes,
        source:          'chatbot',
        chat_session_id: sessionId,
        status:          'pending',
      }).select().single()

      if (error) return { ok: false, error: error.message }

      // Update session with guest info
      await admin.from('chat_sessions')
        .update({ guest_name: input.guest_name, guest_phone: input.guest_phone })
        .eq('session_id', sessionId)

      // Email confirmations — guest (if email given) + owner notification
      const treatmentName = treatment.name ?? 'Spa Treatment'
      const whatsapp = settings?.['settings.whatsapp_number'] ?? '66631175211'
      const ownerEmail = process.env.INQUIRY_EMAIL

      await Promise.allSettled([
        input.guest_email && sendEmail({
          to:      input.guest_email,
          subject: `Booking Confirmed — ${booking.ref_code} — Ton Mai Spa`,
          html:    bookingGuestHtml({
            name:      input.guest_name,
            refCode:   booking.ref_code,
            date:      booking.date,
            time:      booking.time_slot,
            treatment: treatmentName,
            whatsapp,
          }),
        }),
        ownerEmail && sendEmail({
          to:      ownerEmail,
          subject: `New Booking ${booking.ref_code} — ${treatmentName} (chatbot)`,
          html:    bookingOwnerHtml({
            name:      input.guest_name,
            phone:     input.guest_phone,
            refCode:   booking.ref_code,
            date:      booking.date,
            time:      booking.time_slot,
            treatment: treatmentName,
            notes:     input.notes,
          }),
        }),
      ])

      return { ok: true, ref_code: booking.ref_code, booking_id: booking.id }
    }

    default:
      return { ok: false, error: `Unknown tool: ${toolName}` }
  }
}

// ============================================================
// HELPERS
// ============================================================

async function persistSession({ admin, sessionId, messages, assistantText }) {
  // Append assistant reply to messages
  const updatedMessages = [
    ...messages,
    { role: 'assistant', content: assistantText, timestamp: new Date().toISOString() },
  ]

  await admin.from('chat_sessions').upsert(
    {
      session_id:  sessionId,
      messages:    updatedMessages,
      last_active: new Date().toISOString(),
    },
    { onConflict: 'session_id' }
  )
}

function buildEnquiryMessage(input) {
  const parts = [`Booking request via chatbot.`]
  if (input.treatment_name)  parts.push(`Treatment: ${input.treatment_name}`)
  if (input.preferred_date)  parts.push(`Preferred date: ${input.preferred_date}`)
  if (input.preferred_time)  parts.push(`Preferred time: ${input.preferred_time}`)
  if (input.party_size > 1)  parts.push(`Party size: ${input.party_size}`)
  if (input.notes)           parts.push(`Notes: ${input.notes}`)
  return parts.join(' | ')
}

function addMinutesStr(time, mins) {
  const [h, m] = time.split(':').map(Number)
  const total = h * 60 + m + mins
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

// Resolve the treatment the model is referring to — by UUID when it copied
// the [id: …] tag correctly, falling back to a name match when it didn't
// (models occasionally garble UUIDs; a wrong id must not book the wrong
// treatment or silently fail).
async function resolveTreatment(admin, input) {
  if (input.treatment_id) {
    const { data } = await admin.from('spa_treatments')
      .select('id, name, prices, duration_options')
      .eq('id', input.treatment_id).eq('is_active', true).maybeSingle()
    if (data) return data
  }
  if (input.treatment_name) {
    const { data } = await admin.from('spa_treatments')
      .select('id, name, prices, duration_options')
      .ilike('name', `%${input.treatment_name.replace(/[%_]/g, '')}%`)
      .eq('is_active', true).limit(1).maybeSingle()
    if (data) return data
  }
  return null
}
