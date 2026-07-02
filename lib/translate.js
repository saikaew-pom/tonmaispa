// Translates CMS content (treatment names/descriptions, settings text,
// gallery alt text) via MiniMax, caching results in content_translations
// so a given piece of English text is only ever translated once per locale.
// Fails open everywhere — a MiniMax outage or bad response falls back to
// the original English text rather than breaking the page.
import { getMiniMax, MINIMAX_MODEL } from './minimax'
import { createSupabaseAdminClient } from './supabase-admin'

const LOCALE_NAMES = { ru: 'Russian', zh: 'Simplified Chinese', th: 'Thai' }

function extractJson(text) {
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) return null
  try { return JSON.parse(match[0]) } catch { return null }
}

async function callMiniMax(payload, locale) {
  const client = getMiniMax()
  if (!client) return null
  try {
    const resp = await client.messages.create({
      model: MINIMAX_MODEL,
      max_tokens: 4000,
      system: `Translate EVERY string value in this JSON object from English to ${LOCALE_NAMES[locale]}, including short single words like meal names or category labels (e.g. "Breakfast", "Drinks") — do not leave any value in English just because it seems like an internationally-understood word. This is copy for an upscale, calm garden spa and restaurant in Phuket, Thailand — preserve that tone. The only exception: keep the proper noun "Ton Mai Spa" untranslated. Return ONLY a valid JSON object with the exact same keys, translated values, and no other text.`,
      messages: [{ role: 'user', content: JSON.stringify(payload) }],
    })
    const text = resp.content?.[0]?.text ?? ''
    return extractJson(text)
  } catch (err) {
    console.error('[translate] MiniMax call failed:', err.message)
    return null
  }
}

// Single-row helper — translates a flat { field: value } object for one row.
export async function translateFields(table, id, fields, locale) {
  if (locale === 'en') return fields
  const keys = Object.keys(fields).filter(k => fields[k])
  if (!keys.length) return fields

  const admin = createSupabaseAdminClient()
  const { data: cached } = await admin
    .from('content_translations')
    .select('field, translated_text, original_text')
    .eq('source_table', table).eq('source_id', String(id)).eq('locale', locale)
    .in('field', keys)

  const cacheMap = Object.fromEntries((cached ?? []).map(c => [c.field, c]))
  const result = { ...fields }
  const toTranslate = {}
  for (const k of keys) {
    const c = cacheMap[k]
    if (c && c.original_text === fields[k]) result[k] = c.translated_text
    else toTranslate[k] = fields[k]
  }
  if (!Object.keys(toTranslate).length) return result

  const translated = await callMiniMax(toTranslate, locale)
  if (!translated) return result

  const rows = Object.keys(toTranslate).map(k => ({
    source_table: table, source_id: String(id), field: k, locale,
    original_text: toTranslate[k], translated_text: translated[k] ?? toTranslate[k],
  }))
  await admin.from('content_translations').upsert(rows, { onConflict: 'source_table,source_id,field,locale' })
  for (const k of Object.keys(toTranslate)) result[k] = translated[k] ?? toTranslate[k]
  return result
}

// Bulk helper — translates the given fields across many rows in a single
// MiniMax call (payload keyed by row id), instead of one call per row.
// `rows` must each have an `id`. `fields` is the list of field names to
// translate on every row (e.g. ['name', 'description']).
export async function translateRows(table, rows, fields, locale) {
  if (locale === 'en' || !rows.length) return rows

  const admin = createSupabaseAdminClient()
  const ids = rows.map(r => String(r.id))
  const { data: cached } = await admin
    .from('content_translations')
    .select('source_id, field, translated_text, original_text')
    .eq('source_table', table).eq('locale', locale)
    .in('source_id', ids).in('field', fields)

  const cacheMap = {} // `${id}:${field}` -> row
  for (const c of cached ?? []) cacheMap[`${c.source_id}:${c.field}`] = c

  const payload = {} // { id: { field: value } } — only cache misses / stale entries
  for (const row of rows) {
    for (const f of fields) {
      const val = row[f]
      if (!val) continue
      const c = cacheMap[`${row.id}:${f}`]
      if (c && c.original_text === val) continue // cache hit, source unchanged
      payload[row.id] ??= {}
      payload[row.id][f] = val
    }
  }

  let translated = {}
  if (Object.keys(payload).length) {
    translated = (await callMiniMax(payload, locale)) ?? {}
    const upsertRows = []
    for (const id of Object.keys(payload)) {
      for (const f of Object.keys(payload[id])) {
        const value = translated[id]?.[f] ?? payload[id][f]
        upsertRows.push({
          source_table: table, source_id: String(id), field: f, locale,
          original_text: payload[id][f], translated_text: value,
        })
      }
    }
    if (upsertRows.length) {
      await admin.from('content_translations').upsert(upsertRows, { onConflict: 'source_table,source_id,field,locale' })
    }
  }

  return rows.map(row => {
    const out = { ...row }
    for (const f of fields) {
      const c = cacheMap[`${row.id}:${f}`]
      if (c && c.original_text === row[f]) out[f] = c.translated_text
      else if (translated[row.id]?.[f]) out[f] = translated[row.id][f]
    }
    return out
  })
}
