# Ton Mai Spa — Project Playbook

The blueprint for how this project is built, so the next project (or the next
developer/AI session on this one) starts from what we learned instead of
re-deriving it. The generic, reusable version of this knowledge lives in the
`vibe-web-bot-cms-erp` skill (`~/.claude/skills/vibe-web-bot-cms-erp/SKILL.md`);
this file is the concrete map of THIS codebase.

## What this project is

A production business website for a garden spa in Rawai, Phuket:
- **Public site** — multilingual (en/th/ru/zh) marketing pages, spa menu,
  restaurant, blog, and a real-time booking widget
- **Staff dashboard** — bookings (ERP-lite), availability management,
  treatments, therapists, blog CMS, customers, campaigns, analytics, settings
- **AI concierge** — website chat + WhatsApp, able to check real availability
  and prepare (never insert) bookings
- **Notifications** — Brevo email + Twilio WhatsApp, always staff-triggered

Live at https://tonmaispa.vercel.app · repo `saikaew-pom/tonmaispa` · deploys
automatically on push to `main`.

## System map

| System | Key files |
|---|---|
| Supabase clients (browser / server / admin) | `lib/supabase.js`, `lib/supabase-server.js`, `lib/supabase-admin.js` |
| Auth guards (staff/owner/super_admin) | `lib/require-admin.js`, `middleware.js` |
| Availability + capacity truth | `lib/scheduling.js` (`checkSlotCapacity`, `getAvailableSlots`, `excludeBookingId` for edits) |
| Public booking widget | `components/ui/BookingEngine.jsx` (+ `BookingCTA.jsx` toggle) |
| Booking APIs | `app/api/bookings/*` (public), `app/api/admin/bookings/*` (staff, incl. `[id]/notify`, `[id]/whatsapp`, `[id]/logs`, `[id]/therapist-check`) |
| Bookings dashboard | `app/dashboard/bookings/` — calendar + table views, click-to-edit modal, date filters/sort (default: today & upcoming), "Booked on" column, therapist assign + reconfirm popup, notify buttons, audit log modal |
| Booking audit trail | `lib/booking-logs.js`, `booking_logs` table (migration 025) |
| Chatbot brain + tools | `lib/chatbot.js` (prompt + tool schemas), `lib/chat-booking.js` (draft/confirm/**cancel**), `app/api/chat/*` (incl. `cancel-booking`) |
| Chat widget + review card | `components/layout/ChatWidget.jsx` (`BookingDraftCard` collects name/country/phone/email; `BookingConfirmCard`/`BookingLookupCard` carry guest self-service: change date, cancel, book another) |
| Email | `lib/brevo.js` (send + per-event HTML templates) |
| WhatsApp | `lib/twilio.js`, conversations inbox under `app/dashboard/`, webhook under `app/api/twilio/` |
| AI provider | `lib/minimax.js` (Anthropic SDK + baseURL override) — every caller wraps in a hard timeout |
| i18n | `app/[lang]/`, `lib/translate.js` (cache table `content_translations`, 40s hard timeout, fails open to EN), `lib/i18n/` dictionaries |
| Blog CMS | `lib/blog.js`, `lib/blog-ai.js`, `app/dashboard/blog/`, `app/api/admin/blog/*` |
| Blog public | `app/[lang]/blog/`, `lib/sanitize.js`, source content in `blog-content/pillar-*.md` |
| SEO / GEO / perf | `app/sitemap.js` (DB-driven), `app/robots.js`, `lib/json-ld.js` (`spaSchema`, `faqSchema`, `breadcrumbSchema`), `public/llms.txt`, `public/fonts/` (self-hosted woff2, `@font-face` in `app/globals.css`), root rewrite in `middleware.js` |
| Anti-bot | `lib/ratelimit.js`, `lib/verify-turnstile.js` — both fail open |
| Settings & toggles | `app/dashboard/settings/`, `site_content` table, role-gated in `app/api/admin/settings/route.js` |
| Migrations | `supabase/migrations/*.sql` — pasted by hand into Supabase SQL Editor, never auto-run |

## The ten rules this project runs on

1. **One capacity check.** Every booking write path (public, admin, chatbot,
   WhatsApp) goes through `checkSlotCapacity`. Edits pass `excludeBookingId`.
   Full slots return `409 SLOT_FULL`; staff can overbook only via an explicit
   red "book anyway" button.
2. **AI never writes.** The chatbot's `prepare_booking` creates a 15-minute
   draft; only the guest pressing Confirm on the review card inserts — and the
   confirm API re-validates capacity and contact details server-side.
3. **The card collects identity.** Name + country code + phone + email are
   required form fields on the review card, optional in the AI tool schema.
   Required-in-schema fields get hallucinated placeholders ("Guest") — learned
   twice.
4. **One review card at a time.** A second `prepare_booking` destroys an
   unconfirmed draft. Sequencing (confirm #1, then prepare #2) is enforced in
   the system prompt for multi-guest bookings.
5. **Pending until a human says otherwise.** Bookings insert as `pending`;
   creation email says "Received", not "Confirmed". Status-change
   notifications are buttons staff click, state persisted on the booking row
   (`last_email_status` etc.), and the button reappears whenever the last send
   no longer matches the current status.
6. **Everything is logged.** Edits, status changes, and sends write to
   `booking_logs` with the actor's email. "View logs" on every booking.
7. **Hard timeout on every AI call.** 40–60s `Promise.race`, fail open. A
   missing one in translation once killed an entire production deploy during
   static generation. Only EN is pre-rendered; th/ru/zh render on demand.
8. **Static pages use the admin client** and filter to public rows
   explicitly. Cookie clients inside ISR pages crash prod.
9. **Refetch on any parameter change.** The booking widget re-queries
   availability when treatment/duration changes after a date is picked, with a
   request counter against out-of-order responses. Skipping this showed full
   slots as bookable.
10. **Migrations by hand, verified before code ships.** Write the SQL file,
    the owner pastes it in Supabase, then verify the column exists before
    pushing code that selects it — pushing first broke the bookings page once.
11. **The bare domain must never redirect.** `/` is served with a `rewrite`
    to `/en` in `middleware.js`, not a redirect — a 307 there cost ~1.5s on
    every first visit. Canonical tag on the homepage points at `/en` since
    the rewrite hides that from crawlers otherwise.
12. **Fonts are self-hosted, not loaded from Google's CSS API.** The extra
    third-party request blocked render and caused a late text swap/CLS spike.
    `@font-face` blocks in `app/globals.css` point at `public/fonts/*.woff2`
    under the *same* family names (`Cormorant Garamond`, `Inter`) so no
    inline style needed to change; only the two "latin" subsets are
    preloaded in `app/layout.jsx`.
13. **Verify contrast against the actual computed color, not the design
    token.** All 16 WCAG-AA failures found by Lighthouse were opacity/light
    variants of on-brand colors (`rgba(255,255,255,0.4)`, `#C4924A` on light
    backgrounds, `#9B9390`, `#C8C3BC`) that read fine visually but failed the
    4.5:1 ratio — same hex can pass or fail depending on the background it
    sits on, so check each usage site, not just the swatch.
14. **A Twilio 200 is not delivery.** `sendWhatsAppMessage` accepting a
    message only means Twilio queued it — WhatsApp itself can silently drop a
    freeform business-initiated message if the guest hasn't messaged in the
    last 24h (error 63016). Every staff-triggered WhatsApp send now polls
    `fetchMessageStatus` a few seconds after sending and surfaces a real
    failure instead of an optimistic "✓ sent" — this is how a whole batch of
    dashboard sends were found stuck at "queued" forever while the UI
    claimed success. Fix path: an approved Content Template
    (`TWILIO_CONTENT_SID_BOOKING_CONFIRMED`/`_CANCELLED`) delivers outside
    the window; freeform only works inside it.
15. **Guest self-service writes still go through the same rules.** The
    chat widget's Cancel/Change-date buttons call server endpoints that
    re-check ownership (same session or verified customer) and re-validate
    capacity — never a client-side status flip. Guest-initiated actions
    (unlike staff actions) auto-send the email/WhatsApp receipt immediately,
    since the guest performing the action IS the human-in-the-loop that
    rule 5's "staff must click send" exists to require.
16. **Therapist assignment is a capacity check, not a label.** Picking a
    name opens a reconfirm popup backed by a real-time check (qualified +
    on shift + no overlapping booking, same engine as `checkSlotCapacity`)
    before saving — assigning an unavailable therapist is possible only as
    an explicit logged override, mirroring the overbook pattern.

## Operational notes

- **Feature toggles** live in `site_content` (`settings.*`): booking engine,
  chatbot + chatbot booking mode, Twilio WhatsApp, premium AI features,
  maintenance mode. WhatsApp buttons require the toggle AND real Twilio env
  vars — otherwise they don't render at all.
- **Blog content source of truth** is `blog-content/pillar-*.md` (5 pillars ×
  5 posts, front-matter + `### Article`). Import/update scripts parse these
  and INSERT or UPDATE-by-slug into `blog_posts`. Posts cross-link via
  `/blog/<slug>` (middleware redirects to `/en/...`); validate linked slugs
  against the DB before shipping.
- **Testing without dashboard login:** temp Node scripts in `scripts/`
  against the real DB (service role), always cleaning up by exact test IDs,
  then deleted. The dashboard is verified visually by the owner post-deploy.
- **Deploys:** watch `vercel ls` to Ready/Error after every push. An Error
  deploy means prod still serves the old build.
- **Measuring SEO/perf:** the keyless PageSpeed Insights API hits a daily
  quota fast (`RESOURCE_EXHAUSTED`); use `npx lighthouse <url> --output=json
  --form-factor=mobile --screenEmulation.mobile --throttling-method=simulate
  --chrome-flags="--headless=new --no-sandbox"` locally instead — no quota,
  same Lighthouse engine PSI uses. Always re-run against a freshly rebuilt
  local server (`lsof -ti:<port> | xargs kill -9` before `npm start`, a stale
  process silently keeps serving the old `.next` build) and again against
  prod after deploy to confirm the fix actually shipped. "Agentic Browsing"
  is a newer PSI-only category not exposed by the open-source Lighthouse
  CLI — `llms.txt` + FAQPage/BreadcrumbList/`sameAs` schema target it, but
  confirm the score itself via the PSI web tool, not the CLI.
- **Known open items** are tracked in the auto-memory launch checklist, not
  here (Turnstile retest, MOCK- demo data removal, final domain cutover).
- **Dashboard sidebar** (`app/dashboard/DashNav.jsx`) is grouped into
  Operations / Guests / Content / Insights & Admin as the link count grows —
  add new dashboard pages to the right group, don't append to one flat list.
- **Chatbot claim guards** (`app/api/chat/route.js`) currently cover: card
  claimed without a prepare tool, booking ref mentioned without a lookup
  tool, "sent to team" without `capture_booking_intent`. Any new bot
  capability that lets it assert something a tool proves should get the
  same treatment — see [[chatbot-optimizer-fable]].

## Starting a new project from this one

1. Read the `vibe-web-bot-cms-erp` skill for the generic patterns and build
   order (schema → dashboard CRUD → public site → availability engine →
   booking → chatbot → CMS → WhatsApp).
2. Copy the `lib/` helpers that are domain-agnostic: the three Supabase
   clients, `require-admin`, `ratelimit`, `verify-turnstile`, `json-ld`,
   `sanitize`, `translate`, `brevo`, `twilio`, `booking-logs`, and the AI
   provider wrapper with its timeout pattern.
3. Rename the domain: `spa_treatments`/`therapists` become whatever the new
   business schedules (services/staff/tables/rooms) — `lib/scheduling.js`'s
   logic (qualified + shift + no overlap + resource capacity) transfers
   almost unchanged.
4. Keep the ten rules. Every one of them exists because its absence was a
   real bug in this project.
