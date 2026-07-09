// ============================================================
// TON MAI SPA — Blog post importer
// ------------------------------------------------------------
// Parses the blog-content/new-pillar-*.md files, converts each
// article's markdown body to the same HTML shape existing posts
// use (<h3>/<p>/<ul>/<li>/<strong>/<a>), and UPSERTS into
// blog_posts by slug (idempotent — safe to re-run).
//
// Fields written: title, slug, category, excerpt, cover_image_url,
//   body (HTML), author_name, tags, publish_date, read_time_minutes,
//   is_published, is_featured.
//
// Run: node --env-file=.env.local scripts/import-blog-posts.mjs [--dry]
// ============================================================

import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

const DRY = process.argv.includes('--dry')
const PUBLISH_DATE = new Date().toISOString().slice(0, 10) // today, YYYY-MM-DD
const AUTHOR = 'Ton Mai Spa'

const FILES = [
  'blog-content/new-pillar-1-treatments.md',
  'blog-content/new-pillar-2-thermal.md',
  'blog-content/new-pillar-3-local.md',
  'blog-content/new-pillar-4-restaurant.md',
  'blog-content/new-pillar-5-planning.md',
]

// Bespoke, honest 1–2 sentence teasers (shown on the blog index).
const EXCERPTS = {
  'foot-reflexology-explained':
    "A firm, no-oil, fully-clothed treatment that works the whole body through the feet — what it's actually like, who it suits, and why it's one of the best-value ways to recover after a day on your feet in Phuket.",
  'massage-for-sore-muscles-recovery':
    "Deep tissue, CBD recovery or traditional Thai — which massage actually helps sore, overworked muscles, and how to stack it with heat and cold for a proper active-traveler reset.",
  'facials-guide-signature-brightening-mens':
    "Our three facials — Signature, Brightening and Men's Grooming — explained plainly, with prices and honest guidance on which one your sun-tired holiday skin actually wants.",
  'oil-massage-styles-compared':
    "Swedish, Aromatherapy, Thai Oil and Hot Stone all sound identical on the menu. Here's the plain-English difference, and how to pick the one that matches how you want to feel.",
  'massage-add-ons-explained':
    "Scalp oil, eye mask and herbal foot soak — the small, inexpensive add-ons that quietly make a treatment better, what each one solves, and an honest take on when they're worth it.",
  'how-long-each-stage-thermal-circuit':
    "How many minutes in the steam, sauna and cold plunge, the ideal order, and how to build a 90-minute circuit that leaves you glowing rather than wrung out.",
  'thermal-circuit-safety-who-should-take-it-easy':
    "Blood pressure, pregnancy, feeling unwell, or dizzy in the heat? Honest, practical guidance on enjoying the sauna and cold plunge safely — and when to check with your doctor first.",
  'combining-massage-and-thermal-circuit':
    "Our favorite way to spend an afternoon in Rawai: thermal circuit first, then a massage. Why the order matters, how to time it, and the half-price day-pass deal that makes it the best value on the menu.",
  'story-of-ton-mai-spa':
    "Ton Mai Spa exists because someone decided a 150-year-old tamarind tree was worth more than the land it stood on. The short story of the old tree at the heart of the garden — and why it still shapes everything.",
  'reaching-rawai-distances-taxis-parking':
    "Taxi times and driving distances to Ton Mai Spa from Nai Harn, Kata, Patong and the airport, how to get here by taxi, scooter or car, and where to park (free, on site).",
  'garden-cafe-healthy-thai-food':
    "Fresh Thai food, cold smoothies, good coffee and our turmeric latte — a few steps from the treatment salas. What's at the garden café, and why the food you eat around a spa visit genuinely matters.",
  'booking-policies-cancellation-deposit-reschedule':
    "Cancellations, deposits and rescheduling at Ton Mai Spa, in plain language and all in one place — the 48/24-hour windows, whether you need a deposit, and how easy it is to move a booking.",
  'what-to-bring-first-spa-visit':
    "First spa visit? What to bring (almost nothing — we provide the rest), what to wear, the one thing that genuinely matters most, and exactly what to expect from arrival onward.",
  'walk-in-or-book-ahead-timing':
    "When you can just turn up, when you really should book ahead (weekends, holidays, groups), and the same-day-message trick that's the traveler's cheat code for getting in.",
  'booking-groups-couples-occasions':
    "Anniversaries, honeymoons and friends' trips — how couples rooms, group bookings, therapist requests and same-visit multi-treatments work, so a shared spa afternoon is smooth rather than a headache.",
  'opening-hours-and-contact':
    "Open every day, 9am to 11pm. All the ways to reach Ton Mai Spa — WhatsApp, Line, Instagram, Facebook and website chat — the fastest one for same-day booking, and where to find us in Rawai.",
}

// ── Markdown → HTML (scoped to the structures these articles use) ──
function inline(text) {
  // links first so bold inside link text still works
  let out = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, url) => {
    const external = /^https?:\/\//i.test(url)
    const attrs = external ? ` target="_blank" rel="noopener noreferrer"` : ''
    return `<a href="${url}"${attrs}>${label}</a>`
  })
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  return out
}

function mdToHtml(md) {
  const blocks = md.trim().split(/\n\s*\n/)
  const html = []
  for (const raw of blocks) {
    const block = raw.trim()
    if (!block) continue
    if (block.startsWith('#### ')) {
      html.push(`<h3>${inline(block.slice(5).trim())}</h3>`)
      continue
    }
    const lines = block.split('\n').map(l => l.trim()).filter(Boolean)
    if (lines.every(l => /^-\s+/.test(l))) {
      html.push('<ul>' + lines.map(l => `<li>${inline(l.replace(/^-\s+/, ''))}</li>`).join('') + '</ul>')
      continue
    }
    if (lines.every(l => /^\d+\.\s+/.test(l))) {
      html.push('<ol>' + lines.map(l => `<li>${inline(l.replace(/^\d+\.\s+/, ''))}</li>`).join('') + '</ol>')
      continue
    }
    html.push(`<p>${inline(lines.join(' '))}</p>`)
  }
  return html.join('\n')
}

function readTime(html) {
  const words = html.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.round(words / 200))
}

// ── Parse one .md file into post objects ──
function parseFile(text) {
  const posts = []
  // split on "## Post N: Title"
  const parts = text.split(/^## Post \d+:\s*/m).slice(1)
  for (const part of parts) {
    const title = part.split('\n')[0].trim()
    const get = (label) => {
      const m = part.match(new RegExp(`\\*\\*${label}:\\*\\*\\s*\`?([^\`\n]+)\`?`))
      return m ? m[1].trim() : null
    }
    const slug = get('Slug')
    const category = get('Category')
    const cover = get('Featured image URL')
    const articleMatch = part.match(/### Article\s*\n([\s\S]*?)(?:\n---\s*(?:\n|$)|$)/)
    const bodyMd = articleMatch ? articleMatch[1].trim() : ''
    posts.push({ title, slug, category, cover, bodyMd })
  }
  return posts
}

async function main() {
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  const all = []
  for (const f of FILES) {
    const text = await readFile(path.resolve(f), 'utf8')
    all.push(...parseFile(text))
  }
  console.error(`Parsed ${all.length} posts from ${FILES.length} files.`)

  let inserted = 0, updated = 0, failed = 0
  for (const p of all) {
    if (!p.slug || !p.title || !p.category || !p.cover || !p.bodyMd) {
      console.error(`SKIP (incomplete): ${p.slug || p.title}`)
      failed++; continue
    }
    const body = mdToHtml(p.bodyMd)
    const row = {
      title: p.title,
      slug: p.slug,
      category: p.category,
      excerpt: EXCERPTS[p.slug] ?? null,
      cover_image_url: p.cover,
      body,
      author_name: AUTHOR,
      tags: [],
      publish_date: PUBLISH_DATE,
      read_time_minutes: readTime(body),
      is_published: true,
      is_featured: false,
    }
    if (DRY) {
      console.error(`DRY ${p.slug} — ${row.read_time_minutes}min, ${body.length} chars body, excerpt ${row.excerpt ? 'yes' : 'MISSING'}`)
      continue
    }
    const { data: existing } = await admin.from('blog_posts').select('id').eq('slug', p.slug).maybeSingle()
    if (existing) {
      const { error } = await admin.from('blog_posts').update(row).eq('id', existing.id)
      if (error) { console.error(`FAIL update ${p.slug}: ${error.message}`); failed++ }
      else { console.error(`updated ${p.slug}`); updated++ }
    } else {
      const { error } = await admin.from('blog_posts').insert(row)
      if (error) { console.error(`FAIL insert ${p.slug}: ${error.message}`); failed++ }
      else { console.error(`inserted ${p.slug}`); inserted++ }
    }
  }
  console.log(JSON.stringify({ inserted, updated, failed, publish_date: PUBLISH_DATE }))
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1) })
