// ============================================================
// TON MAI SPA — Blog featured-image generator
// ------------------------------------------------------------
// Purpose-built for blog cover images. Three fixed behaviours,
// per spec:
//   1. GPT-Image-2 on Fal ONLY (the model the owner picked for
//      its realistic look), 16:9 landscape for blog covers.
//   2. Upload to Cloudinary if creds are present (folder `blog/`,
//      keyed by the post slug so the library stays consistent
//      with existing covers). If Cloudinary is unavailable, fall
//      back to a COMPRESSED local JPEG instead of a ~2 MB PNG.
//   3. Name the file after the blog post (self-explanatory):
//      `blog/<slug>--gptimage2` on Cloudinary, or
//      `blog-images/<slug>.jpg` locally.
//
// SINGLE run:
//   npm run blog:image -- --slug <blog-slug> --prompt "<image prompt>"
//
// BATCH run (concurrent — the practical way to make many covers):
//   npm run blog:image -- --batch blog-content/blog-image-prompts.json [--concurrency 4]
//   where the JSON is: [{ "slug": "...", "prompt": "..." }, ...]
//
// Options:
//   --slug / --prompt   single mode (both required together)
//   --batch <file>      batch mode, a JSON array of { slug, prompt }
//   --concurrency <n>   parallel jobs in batch mode (default 4)
//   --square            1024x1024 instead of the default 1536x864 (16:9)
//   --keep-local        also save a local compressed copy even when Cloudinary succeeds
//   --skip-existing     batch mode: skip slugs whose Cloudinary asset already exists
// ============================================================

import { mkdir, stat, readFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const FAL_MODEL = 'fal-ai/gpt-image-2'
// 16:9 blog-cover size. Multiples of 16, within Fal's limits
// (max edge 3840, 655k–8.29M total px). 1536x864 = 1.33M px → crisp.
const COVER_SIZE = { width: 1536, height: 864 }
const SQUARE_SIZE = { width: 1024, height: 1024 }

function parseArgs(argv) {
  const out = {}
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) continue
    const key = argv[i].slice(2)
    const next = argv[i + 1]
    if (next === undefined || next.startsWith('--')) out[key] = true
    else out[key] = argv[++i]
  }
  return out
}

const args = parseArgs(process.argv.slice(2))
const size = args.square ? SQUARE_SIZE : COVER_SIZE
const keepLocal = Boolean(args['keep-local'])

const FAL_KEY = process.env.FAL_KEY
if (!FAL_KEY) {
  console.error('ERROR: FAL_KEY not set. Run via `npm run blog:image` (which loads .env.local), not bare node.')
  process.exit(2)
}
const CLOUD = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
const PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET

function assertSlug(slug) {
  if (!slug || typeof slug !== 'string' || !/^[a-z0-9-]+$/.test(slug)) {
    throw new Error(`--slug must be a kebab-case blog slug (got "${slug}").`)
  }
}

// ── 1. Generate with GPT-Image-2 on Fal ─────────────────────
async function generate(slug, prompt) {
  const submit = await fetch(`https://queue.fal.run/${FAL_MODEL}`, {
    method: 'POST',
    headers: { Authorization: `Key ${FAL_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, image_size: size, num_images: 1 }),
  })
  const job = await submit.json()
  if (!submit.ok) {
    throw new Error(`Fal submit failed (${submit.status}): ${JSON.stringify(job).slice(0, 300)}`)
  }

  // GPT-Image-2 is slow (~1–5 min). Poll patiently, up to 12 min.
  const started = Date.now()
  while (Date.now() - started < 12 * 60 * 1000) {
    await new Promise(r => setTimeout(r, 4000))
    const s = await fetch(job.status_url, { headers: { Authorization: `Key ${FAL_KEY}` } })
    const sj = await s.json()
    if (sj.status === 'COMPLETED') break
    if (sj.status === 'FAILED' || sj.status === 'ERROR') {
      throw new Error(`Fal generation failed: ${JSON.stringify(sj).slice(0, 300)}`)
    }
  }

  const r = await fetch(job.response_url, { headers: { Authorization: `Key ${FAL_KEY}` } })
  const result = await r.json()
  const url = result?.images?.[0]?.url
  if (!url) throw new Error(`No image URL in Fal result: ${JSON.stringify(result).slice(0, 300)}`)
  return url
}

// ── 2a. Upload to Cloudinary (unsigned preset), named by slug ─
async function uploadCloudinary(slug, imageUrl) {
  if (!CLOUD || !PRESET) return null
  const form = new URLSearchParams()
  form.set('file', imageUrl) // Cloudinary fetches the remote Fal URL directly
  form.set('upload_preset', PRESET)
  form.set('folder', 'blog')
  form.set('public_id', `${slug}--gptimage2`) // matches existing `blog/<slug>--<model>` convention
  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD}/image/upload`, { method: 'POST', body: form })
  const j = await res.json()
  if (!res.ok) throw new Error(`Cloudinary upload failed: ${j?.error?.message ?? JSON.stringify(j).slice(0, 300)}`)
  return j.secure_url
}

// ── 2b. Local fallback: COMPRESSED jpeg, named by slug ───────
async function saveLocalCompressed(slug, imageUrl) {
  const buf = Buffer.from(await (await fetch(imageUrl)).arrayBuffer())
  const outDir = path.resolve('blog-images')
  await mkdir(outDir, { recursive: true })
  const outPath = path.join(outDir, `${slug}.jpg`)
  await sharp(buf).jpeg({ quality: 82, mozjpeg: true }).toFile(outPath)
  const { size: bytes } = await stat(outPath)
  return { outPath, bytes }
}

async function cloudinaryExists(slug) {
  if (!CLOUD) return false
  const u = `https://res.cloudinary.com/${CLOUD}/image/upload/blog/${slug}--gptimage2.png`
  try {
    const r = await fetch(u, { method: 'HEAD' })
    return r.ok
  } catch { return false }
}

// One post, end to end. Returns a result record.
async function processOne(slug, prompt) {
  assertSlug(slug)
  if (!prompt || typeof prompt !== 'string') throw new Error(`missing prompt for "${slug}"`)
  const imageUrl = await generate(slug, prompt)
  let cloudUrl = null
  try {
    cloudUrl = await uploadCloudinary(slug, imageUrl)
  } catch (e) {
    console.error(`[blog-image] ${slug}: Cloudinary failed, falling back to local — ${e.message}`)
  }
  if (cloudUrl) {
    if (keepLocal) await saveLocalCompressed(slug, imageUrl)
    return { slug, storage: 'cloudinary', url: cloudUrl }
  }
  const { outPath, bytes } = await saveLocalCompressed(slug, imageUrl)
  return { slug, storage: 'local', path: outPath, bytes }
}

// Bounded-concurrency pool.
async function runPool(items, concurrency, worker) {
  const results = new Array(items.length)
  let idx = 0
  async function next() {
    const i = idx++
    if (i >= items.length) return
    try {
      results[i] = { ok: true, value: await worker(items[i], i) }
    } catch (e) {
      results[i] = { ok: false, slug: items[i].slug, error: e.message }
    }
    return next()
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, next))
  return results
}

// ── Entry ────────────────────────────────────────────────────
;(async () => {
  if (args.batch) {
    const file = path.resolve(String(args.batch))
    const list = JSON.parse(await readFile(file, 'utf8'))
    if (!Array.isArray(list) || !list.length) throw new Error(`batch file has no items: ${file}`)
    let items = list
    if (args['skip-existing']) {
      const kept = []
      for (const it of list) {
        if (await cloudinaryExists(it.slug)) console.error(`[blog-image] skip (exists): ${it.slug}`)
        else kept.push(it)
      }
      items = kept
    }
    const concurrency = Number(args.concurrency) || 4
    console.error(`[blog-image] Batch: ${items.length} covers, ${FAL_MODEL} ${size.width}x${size.height}, concurrency ${concurrency}. This runs several minutes.`)
    const t0 = Date.now()
    const results = await runPool(items, concurrency, it => {
      console.error(`[blog-image] start: ${it.slug}`)
      return processOne(it.slug, it.prompt).then(r => { console.error(`[blog-image]  done: ${it.slug} → ${r.storage}`); return r })
    })
    const ok = results.filter(r => r.ok).map(r => r.value)
    const failed = results.filter(r => !r.ok)
    console.error(`\n[blog-image] Batch finished in ${Math.round((Date.now() - t0) / 1000)}s — ${ok.length} ok, ${failed.length} failed.`)
    console.log(JSON.stringify({ ok, failed }, null, 2))
    if (failed.length) process.exitCode = 1
    return
  }

  // Single mode
  assertSlug(args.slug)
  const res = await processOne(args.slug, args.prompt)
  console.log(JSON.stringify(res))
  if (res.storage === 'cloudinary') {
    console.error(`\n✅ Cloudinary URL (paste into the post's Featured image URL / cover_image_url):\n${res.url}\n`)
  } else {
    console.error(`\n✅ Saved compressed locally (Cloudinary not configured):\n${res.path} (${Math.round(res.bytes / 1024)} KB)\n`)
  }
})().catch(e => {
  console.error(`[blog-image] ERROR: ${e.message}`)
  process.exit(1)
})
