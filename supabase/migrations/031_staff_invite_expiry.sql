-- 031_staff_invite_expiry.sql
--
-- Staff invitations become durable (5 days) instead of relying on Supabase's
-- own email link, whose expiry is capped at 24h and is shared with every
-- password reset (raising it globally would weaken resets for everyone).
--
-- The 5-day link is our own HMAC-signed token (lib/staff-invite.js), the same
-- pattern already used for WhatsApp booking-request deep links. These columns
-- are the server-side state that makes the token revocable and lets the daily
-- reminder job know who still hasn't activated.
--
-- Tracking notification state on the row itself follows the precedent set by
-- bookings (last_email_sent_at, whatsapp_reminder_sent_at, ...).

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS invited_at              timestamptz,
  -- NULL = no invite outstanding. Setting it NULL is also the revoke switch:
  -- it immediately invalidates every issued token for this user.
  ADD COLUMN IF NOT EXISTS invite_expires_at       timestamptz,
  ADD COLUMN IF NOT EXISTS invite_reminder_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS invite_reminder_count   int NOT NULL DEFAULT 0;

-- The reminder job scans only outstanding invites; keep that scan cheap.
CREATE INDEX IF NOT EXISTS idx_profiles_pending_invite
  ON profiles (invite_expires_at)
  WHERE invite_expires_at IS NOT NULL;
