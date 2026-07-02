// One-time script — run manually (`node scripts/generate-dictionaries.mjs`)
// whenever lib/i18n/dictionaries/en.json changes. Translates the whole
// dictionary via MiniMax in one call per locale and writes the result.
// Not run at request time.
import Anthropic from '@anthropic-ai/sdk'
import { readFileSync, writeFileSync } from 'fs'
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

for (const [locale, localeName] of Object.entries(LOCALE_NAMES)) {
  console.log(`Translating dictionary to ${localeName}...`)
  const resp = await client.messages.create({
    model: 'MiniMax-M3',
    max_tokens: 4000,
    system: `Translate every string value in this JSON object from English to ${localeName}. This is UI copy for an upscale, calm garden spa in Phuket, Thailand — preserve that tone, keep it concise (these are nav labels/buttons, not prose). Keep "Ton Mai Spa" untranslated. Return ONLY a valid JSON object with the exact same structure and keys, translated values, no other text.`,
    messages: [{ role: 'user', content: JSON.stringify(en, null, 2) }],
  })
  const text = resp.content?.[0]?.text ?? ''
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) {
    console.error(`  Failed to parse response for ${locale}:`, text.slice(0, 200))
    continue
  }
  const translated = JSON.parse(match[0])
  const outPath = path.join(DICT_DIR, `${locale}.json`)
  writeFileSync(outPath, JSON.stringify(translated, null, 2) + '\n')
  console.log(`  Wrote ${outPath}`)
}
