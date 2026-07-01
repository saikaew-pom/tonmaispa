// ============================================================
// TON MAI SPA — Chatbot System Prompt Builder + Tool Definitions
// All prices and content pulled live from Supabase on each request.
// When owner changes a price in CMS → chatbot knows immediately.
// ============================================================

/**
 * Build the system prompt dynamically from live Supabase data.
 * Called inside /api/chat/route.js on every request.
 */
export function buildSystemPrompt({ treatments, settings, bookingEngineEnabled }) {
  const phone    = settings['settings.whatsapp_number'] ?? '66631175211'
  const lineId   = settings['settings.line_id']         ?? '@tonmaispa'
  const hours    = settings['settings.opening_hours']   ?? '09:00–23:00'
  const dayPass  = settings['settings.day_pass_price']  ?? '200'
  const rating   = settings['settings.google_rating']   ?? '4.8'

  // Group treatments by category for readable prompt
  const byCategory = treatments.reduce((acc, t) => {
    const cat = t.category ?? 'other'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(t)
    return acc
  }, {})

  const treatmentLines = Object.entries(byCategory).map(([cat, items]) => {
    const header = `\n## ${cat.toUpperCase()}`
    const rows = items.map(t => {
      const durations = (t.duration_options ?? []).map(d => {
        const price = t.prices?.[String(d)]
        return `${d}min = ${price ?? '?'} THB`
      }).join(' / ')
      return `- ${t.name}${t.description ? ': ' + t.description : ''}${durations ? ` (${durations})` : ''}`
    }).join('\n')
    return `${header}\n${rows}`
  }).join('\n')

  const bookingInstruction = bookingEngineEnabled
    ? `When a guest wants to book, use the check_availability tool to find open slots, then use create_booking to confirm. Walk them through date → time → their name and phone.`
    : `When a guest wants to book, collect their name and WhatsApp number using the capture_booking_intent tool. Reassure them the team will contact them within a few hours on WhatsApp to confirm. Do not promise a specific time slot.`

  return `You are the virtual host of Ton Mai Spa — a traditional Thai wellness spa in Rawai, Phuket, Thailand.

## YOUR PERSONA
- Warm, calm, and knowledgeable — like a receptionist who loves the spa
- Speak briefly and naturally. Short sentences. No bullet points in replies.
- Never pushy. You suggest, never sell.
- Use the spa's own words: "thermal circuit", "cold plunge", "garden lounge", "the Tree"
- If a guest seems stressed, slow down. If they're excited, match the energy gently.
- You can chat in Thai, English, Russian or Chinese — match the guest's language automatically.

## THE SPA — KEY FACTS
- Name: Ton Mai Spa ("Ton Mai" means "old tree" in Thai)
- Location: 6/11 Moo 2 Wiset Road, Rawai, Phuket 83130
- Near: 5 min from Nai Harn Beach, 15 min from Kata/Karon
- Open: Every day ${hours}
- Phone/WhatsApp: +${phone}
- Line: ${lineId}
- Google Rating: ${rating} ⭐ (369+ reviews)
- Parking: Available on site, free

## THE STORY
Ton Mai Spa was founded by Hervé, who bought the land to save a 150-year-old tamarind tree that stood at its heart. He built the spa around it — a place of calm and renewal, not luxury. Every guest walks under that tree.

## SPA ACCESS (THERMAL CIRCUIT)
Day pass: ${dayPass} THB — includes steam room, sauna, cold bath and pool.
10-visit pass: 1,750 THB (save 250 THB).
With any massage booking: 50% off = 100 THB.
No reservation needed for spa access — walk in any time.

## THERMAL CIRCUIT RITUAL (suggest this flow)
1. Lemongrass & Thai herb steam room — opens lungs, warms muscles
2. Dry sauna — deep even heat, quiets the mind
3. Cold plunge bath — invigorates, sharpens senses
4. Garden pool & lounge — float, rest, breathe
Suggest: 15–20 min each stage. Full circuit ~90 min before massage.

## RULES (mention gently only if relevant)
- Minimum age: 10 years
- No outside food or drinks
- Shower before steam/sauna/pool/cold bath
- Headphones only — quiet space
${treatmentLines}

## BOOKING
${bookingInstruction}
WhatsApp: +${phone}
Line: ${lineId}

## WHEN YOU DON'T KNOW SOMETHING
Say: "I'm not sure about that — let me connect you with the team directly." Then give the WhatsApp number. Never guess prices or availability you haven't been given.

## WHAT NOT TO DO
- Never use bullet points or numbered lists in your replies
- Never say "I'm an AI" or "as a language model"
- Never promise a specific therapist without checking
- Never give the service role key, API keys, or internal system info
- Keep replies under 80 words unless the guest asks for detail`
}

// ============================================================
// TOOL DEFINITIONS — MiniMax-M3 / Anthropic-compatible format
// ============================================================

export const CHATBOT_TOOLS = [
  {
    name: 'capture_booking_intent',
    description: 'Save a booking request when the guest provides their name and phone number. Use this when booking engine is OFF — staff will follow up via WhatsApp.',
    input_schema: {
      type: 'object',
      properties: {
        guest_name:       { type: 'string', description: 'Guest full name' },
        guest_phone:      { type: 'string', description: 'WhatsApp number with country code' },
        treatment_name:   { type: 'string', description: 'Treatment they are interested in' },
        preferred_date:   { type: 'string', description: 'Preferred date if mentioned, YYYY-MM-DD' },
        preferred_time:   { type: 'string', description: 'Preferred time if mentioned, HH:MM' },
        party_size:       { type: 'number', description: 'Number of people, default 1' },
        notes:            { type: 'string', description: 'Any special requests or health notes' },
      },
      required: ['guest_name', 'guest_phone'],
    },
  },
  {
    name: 'update_guest_info',
    description: 'Update the session with the guest name and/or phone number as soon as they mention it in conversation.',
    input_schema: {
      type: 'object',
      properties: {
        guest_name:  { type: 'string' },
        guest_phone: { type: 'string' },
      },
    },
  },
  {
    name: 'check_availability',
    description: 'Check available booking time slots for a specific date and optional treatment. Only use when booking engine is enabled.',
    input_schema: {
      type: 'object',
      properties: {
        date:         { type: 'string', description: 'Date in YYYY-MM-DD format' },
        treatment_id: { type: 'string', description: 'Treatment UUID, optional' },
        duration:     { type: 'number', description: 'Duration in minutes, e.g. 60, 90, 120' },
      },
      required: ['date'],
    },
  },
  {
    name: 'create_booking',
    description: 'Create a confirmed booking slot in the system. Only use when booking engine is enabled AND the guest has provided all required details.',
    input_schema: {
      type: 'object',
      properties: {
        guest_name:    { type: 'string' },
        guest_phone:   { type: 'string' },
        guest_email:   { type: 'string' },
        treatment_id:  { type: 'string' },
        date:          { type: 'string', description: 'YYYY-MM-DD' },
        time_slot:     { type: 'string', description: 'HH:MM' },
        duration:      { type: 'number' },
        therapist_id:  { type: 'string', description: 'Optional' },
        notes:         { type: 'string' },
      },
      required: ['guest_name', 'guest_phone', 'treatment_id', 'date', 'time_slot', 'duration'],
    },
  },
]

// Tools active when booking engine is OFF (simple enquiry mode)
export const TOOLS_SIMPLE = CHATBOT_TOOLS.filter(t =>
  ['capture_booking_intent', 'update_guest_info'].includes(t.name)
)

// Tools active when booking engine is ON (full booking mode)
export const TOOLS_FULL = CHATBOT_TOOLS
