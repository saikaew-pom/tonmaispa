// The daily "your invitation is still waiting" job.
//
// Lives in lib/ (not in the route) because two routes drive it: its own
// endpoint (manual trigger + cron entry point) and the send-followups cron
// handler, which piggybacks it while the Vercel account is on the Hobby plan
// and only has two cron slots.

import { sendEmail, inviteReminderEmailHtml } from '@/lib/brevo'
import { createStaffInviteUrl, daysRemaining, formatInviteExpiry } from '@/lib/staff-invite'

// A day's grace, minus enough slack that a cron firing slightly early never
// skips a day. Vercel Hobby crons are only approximately on time.
const MIN_GAP_MS = 20 * 60 * 60 * 1000

export async function runInviteReminderSend({ admin, now = new Date() }) {
  const { data: profiles, error } = await admin
    .from('profiles')
    .select('id, full_name, role, is_active, invited_at, invite_expires_at, invite_reminder_sent_at, invite_reminder_count')
    .not('invite_expires_at', 'is', null)
    .order('invite_expires_at', { ascending: true })

  if (error) {
    const err = new Error(error.message)
    err.status = 500
    throw err
  }

  const pending = profiles ?? []
  const summary = { checked: pending.length, sent: 0, activated: 0, expired: 0, skipped: 0, errors: [] }
  if (!pending.length) return { ok: true, ...summary }

  // Activation state and email live in auth.users, not profiles — same
  // approach as GET /api/admin/users.
  const { data: authUsers } = await admin.auth.admin.listUsers({ perPage: 200 })
  const authById = Object.fromEntries((authUsers?.users ?? []).map(u => [u.id, u]))

  for (const profile of pending) {
    const user = authById[profile.id]

    // Activated → stop reminding AND revoke every outstanding token.
    if (user?.last_sign_in_at) {
      const { error: clearError } = await admin
        .from('profiles').update({ invite_expires_at: null }).eq('id', profile.id)
      if (clearError) summary.errors.push({ id: profile.id, error: clearError.message })
      else summary.activated += 1
      continue
    }

    if (profile.is_active === false || !user?.email) { summary.skipped += 1; continue }

    if (Date.parse(profile.invite_expires_at) <= now.getTime()) { summary.expired += 1; continue }

    // The invite (or a resend) went out today — don't pile a reminder on top.
    if (profile.invited_at && now.getTime() - Date.parse(profile.invited_at) < MIN_GAP_MS) {
      summary.skipped += 1
      continue
    }

    // At most one reminder per day, and idempotent if the cron double-fires.
    if (profile.invite_reminder_sent_at && now.getTime() - Date.parse(profile.invite_reminder_sent_at) < MIN_GAP_MS) {
      summary.skipped += 1
      continue
    }

    let actionLink
    try {
      // Regenerated from the STORED expiry, so the link stays identical to the
      // one in the original invite email.
      actionLink = createStaffInviteUrl({
        userId: profile.id,
        email: user.email,
        expiresAt: profile.invite_expires_at,
      })
    } catch (err) {
      summary.errors.push({ id: profile.id, error: err.message })
      continue
    }

    const result = await sendEmail({
      to: user.email,
      subject: 'Reminder: your Ton Mai Spa invitation is waiting',
      html: inviteReminderEmailHtml({
        fullName: profile.full_name,
        role: profile.role,
        actionLink,
        daysLeft: daysRemaining(profile.invite_expires_at, now),
        expiresAtLabel: formatInviteExpiry(profile.invite_expires_at),
      }),
      ignoreTestTo: true, // must reach the real person, not a dev test inbox
    })

    if (!result.ok) {
      summary.errors.push({ id: profile.id, error: result.error || 'send failed' })
      continue
    }

    const { error: updateError } = await admin
      .from('profiles')
      .update({
        invite_reminder_sent_at: now.toISOString(),
        invite_reminder_count: (profile.invite_reminder_count ?? 0) + 1,
      })
      .eq('id', profile.id)
    if (updateError) summary.errors.push({ id: profile.id, error: updateError.message })

    summary.sent += 1
  }

  return { ok: true, ...summary }
}
