// One-time script — run manually (`node scripts/generate-dictionaries.mjs`)
// whenever lib/i18n/dictionaries/en.json changes. Translates each top-level
// section of the dictionary in its own MiniMax call (rather than the whole
// file at once) since the combined dictionary is large enough that a single
// call risks the model truncating its JSON output mid-array. Writes the
// merged result per locale. Not run at request time.
import Anthropic from '@anthropic-ai/sdk'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DICT_DIR  = path.join(__dirname, '../lib/i18n/dictionaries')

const LOCALE_NAMES = { ru: 'Russian', zh: 'Simplified Chinese', th: 'Thai' }

const apiKey = process.env.MINIMAX_API_KEY
if (!apiKey) {
  console.error('MINIMAX_API_KEY is not set in the environment. Run with:\n  MINIMAX_API_KEY=... node scripts/generate-dictionaries.mjs')
  process.exit(1)
}

const client = new Anthropic({ apiKey, baseURL: 'https://api.minimax.io/anthropic' })
const en = JSON.parse(readFileSync(path.join(DICT_DIR, 'en.json'), 'utf-8'))

function extractJson(text) {
  const match = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/)
  if (!match) return null
  try { return JSON.parse(match[0]) } catch { return null }
}

async function translateSection(sectionKey, sectionValue, localeName) {
  const resp = await client.messages.create({
    model: 'MiniMax-M3',
    max_tokens: 8000,
    system: `Translate every string value in this JSON from English to ${localeName}. This is copy for an upscale, calm garden spa and restaurant in Phuket, Thailand — preserve that tone. Translate EVERY value, including short single words (e.g. "Breakfast", "Drinks") — don't leave a value in English just because it seems internationally understood. The only exception: keep the proper noun "Ton Mai Spa" untranslated. Return ONLY the translated JSON with the exact same structure and keys, no other text.`,
    messages: [{ role: 'user', content: JSON.stringify(sectionValue, null, 2) }],
  })
  const text = resp.content?.[0]?.text ?? ''
  const translated = extractJson(text)
  if (!translated) {
    console.error(`    Failed to parse response for section "${sectionKey}":`, text.slice(0, 300))
    return sectionValue // fall back to English for this section rather than losing it
  }
  return translated
}

for (const [locale, localeName] of Object.entries(LOCALE_NAMES)) {
  console.log(`Translating dictionary to ${localeName}...`)
  const outPath = path.join(DICT_DIR, `${locale}.json`)
  // Resume-friendly: if a partial file exists from a prior failed run, keep
  // whatever sections it already has and only (re)translate missing ones —
  // avoids re-spending API calls on sections that already succeeded.
  const existing = existsSync(outPath) ? JSON.parse(readFileSync(outPath, 'utf-8')) : {}
  const result = { ...existing }

  for (const [sectionKey, sectionValue] of Object.entries(en)) {
    if (result[sectionKey]) {
      console.log(`  Skipping "${sectionKey}" (already translated)`)
      continue
    }
    console.log(`  Translating section "${sectionKey}"...`)
    result[sectionKey] = await translateSection(sectionKey, sectionValue, localeName)
    // Write after every section so a crash partway through doesn't lose progress.
    writeFileSync(outPath, JSON.stringify(result, null, 2) + '\n')
  }
  console.log(`  Wrote ${outPath}`)
}
