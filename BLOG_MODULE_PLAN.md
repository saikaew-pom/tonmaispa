# Blog Module Plan — Ton Mai Spa

Reference: agency-CMS style blog admin (Blog Posts list, Edit post page with live preview, AI-assisted writing) shown in screenshots from a real-estate site, adapted here for the spa.

## Scope confirmed with owner
- Categories: fixed list, set once, staff pick from a dropdown (not freeform per post).
- AI assistance: both a full first-draft generator ("Write with AI") and a one-click excerpt generator ("Generate with AI"). Both are suggestions dropped into the form — staff must hit Save; nothing auto-publishes.
- Public placement: new top-level nav link **"Blog"** at `/blog`.

## 1. Database — `supabase/migrations/024_blog_posts.sql`
```sql
CREATE TABLE blog_posts (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title              text NOT NULL,
  slug               text NOT NULL UNIQUE,
  category           text NOT NULL,
  excerpt            text,
  cover_image_url    text,
  body               text,               -- rich text stored as HTML
  author_name        text,
  tags               text[] DEFAULT '{}',
  publish_date       date NOT NULL DEFAULT CURRENT_DATE,
  read_time_minutes  integer,            -- auto-computed from word count, editable override
  is_published       boolean NOT NULL DEFAULT false,
  is_featured        boolean NOT NULL DEFAULT false,
  created_at         timestamptz DEFAULT now(),
  updated_at         timestamptz DEFAULT now()
);
CREATE INDEX idx_blog_posts_published ON blog_posts(is_published, publish_date DESC);

ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON blog_posts
  FOR ALL USING (auth.role() = 'service_role');
```
RLS: service-role only, matching every other table in this project.

## 2. Categories — fixed list
A small `BLOG_CATEGORIES` config in `lib/blog.js`, same pattern as `TREATMENT_CATEGORIES` in `lib/display.js` — e.g. `Wellness Tips`, `Spa Guide`, `Recipes`, `News`. Owner confirms the exact list before build; trivial to change later since it's just an array, not a table.

## 3. AI features — `lib/blog-ai.js`
Two separate one-shot MiniMax calls (not the full 3-stage critique pipeline — overkill for blog copy), both using the same hard-timeout pattern already in `lib/analytics-interpret.js` (MiniMax latency is unpredictable, ~13s to minutes — see `minimax_latency_note` memory):

- **"Write with AI"** — given a title + category, drafts a full article body (HTML, H2/H3 structure, ~800-1200 words), grounded in Ton Mai Spa's real facts (location, treatments list, hours) pulled from `site_content`/`spa_treatments` so it never invents details about the business. Explicit instruction: no medical/health claims beyond general wellness language.
- **"Generate with AI" (excerpt)** — given the current body text, writes a 1-2 sentence excerpt.

## 4. API routes
- `app/api/admin/blog/route.js` — GET list (search/filter by category + status), POST create
- `app/api/admin/blog/[id]/route.js` — GET one, PATCH, DELETE
- `app/api/admin/blog/generate-draft/route.js` — POST `{ title, category }` → AI body
- `app/api/admin/blog/generate-excerpt/route.js` — POST `{ body }` → AI excerpt
- Cover image upload reuses the existing Cloudinary direct-upload pattern (same as Gallery/Banners/Facilities) — no new upload endpoint needed, just the client-side widget + paste-URL fallback.

## 5. Dashboard UI
- **`/dashboard/blog`** — list page: stat cards (Total / Published / Drafts / Featured), search + category/status filters, sortable table, "+ New post" button.
- **`/dashboard/blog/[id]`** (or `/new`) — dedicated edit page (full page, not a modal, with a live-preview side panel, matching the reference):
  - Basics: title, category dropdown, slug (auto-generated from title, editable), excerpt + Generate-with-AI button
  - Cover image: Cloudinary upload or paste-URL
  - Article body: lightweight rich-text toolbar (H2/H3/bold/italic/list/quote/link/image via `contentEditable`, no heavy rich-text library needed) + Write-with-AI button, live word count + auto read-time
  - Meta: publish date, tags
  - Publishing: Published toggle, Featured toggle
  - Right-hand Live Preview card showing exactly how the post renders on the public index
- Nav link: `{ href: '/dashboard/blog', label: 'Blog' }`.

## 6. Public site
- **`/[lang]/blog`** — index page: hero header (spa-appropriate copy, owner approves final wording), large featured-post card, grid of the rest, category filter chips.
- **`/[lang]/blog/[slug]`** — detail page: cover image, title, meta (category/date/read time/author), body, related-posts footer.
- Translated via `translateRows('blog_posts', posts, ['title','excerpt','body'], lang)` — same mechanism as Treatments/Facilities. Translating full HTML `body` is the one new wrinkle (longer content than prior uses) — verify MiniMax handles HTML-in-JSON cleanly during testing, with a plain-text fallback if formatting breaks.
- Add to `Nav.jsx` / `Footer.jsx`, `sitemap.js` (no `robots.js` change needed — already excludes `/dashboard`, `/api`, `/auth`).

## 7. Verification
1. `npm run build` after each step.
2. Create a real post through the dashboard (with and without AI assist), publish it, confirm it renders correctly at `/blog/[slug]` in all 4 languages.
3. Confirm draft posts (`is_published: false`) are invisible on the public site but visible in the dashboard.
4. Confirm the featured-post logic picks the right one on the index page.
5. Clean up test posts before calling it done.

## Suggested build order
Given the size of this feature (new public route + rich text editor + two AI touchpoints), build in two passes:
1. **Pass 1** — database + dashboard CRUD (sections 1-5), verified solidly on its own.
2. **Pass 2** — public pages + nav/sitemap (section 6), once Pass 1 is confirmed working.
