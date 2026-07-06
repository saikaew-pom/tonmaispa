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
| Booking APIs | `app/api/bookings/*` (public), `app/api/admin/bookings/*` (staff, incl. `[id]/notify`, `[id]/whatsapp`, `[id]/logs`) |
| Bookings dashboard | `app/dashboard/bookings/` — calendar + table views, click-to-edit modal, date filters/sort, notify buttons, audit log modal |
| Booking audit trail | `lib/booking-logs.js`, `booking_logs` table (migration 025) |
| Chatbot brain + tools | `lib/chatbot.js` (prompt + tool schemas), `lib/chat-booking.js` (draft/confirm), `app/api/chat/*` |
| Chat widget + review card | `components/layout/ChatWidget.jsx` (`BookingDraftCard` collects name/country/phone/email) |
| Email | `lib/brevo.js` (send + per-event HTML templates) |
| WhatsApp | `lib/twilio.js`, conversations inbox under `app/dashboard/`, webhook under `app/api/twilio/` |
| AI provider | `lib/minimax.js` (Anthropic SDK + baseURL override) — every caller wraps in a hard timeout |
| i18n | `app/[lang]/`, `lib/translate.js` (cache table `content_translations`, 40s hard timeout, fails open to EN), `lib/i18n/` dictionaries |
| Blog CMS | `lib/blog.js`, `lib/blog-ai.js`, `app/dashboard/blog/`, `app/api/admin/blog/*` |
| Blog public | `app/[lang]/blog/`, `lib/sanitize.js`, source content in `blog-content/pillar-*.md` |
| SEO | `app/sitemap.js` (DB-driven), `app/robots.js`, `lib/json-ld.js` |
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
- **Known open items** are tracked in the auto-memory launch checklist, not
  here (Turnstile retest, MOCK- demo data removal, final domain cutover).

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
