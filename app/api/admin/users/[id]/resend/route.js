import { requireOwnerOrAbove } from '@/lib/require-admin'
import { sendEmail, inviteEmailHtml, passwordResetEmailHtml } from '@/lib/brevo'
import {
  createStaffInviteUrl,
  getInviteExpiry,
  formatInviteExpiry,
  INVITE_LIFETIME_DAYS,
} from '@/lib/staff-invite'

// POST /api/admin/users/[id]/resend
// If the account has never signed in, regenerates a fresh invite link (the
// original one may have expired). If they've already signed in at least
// once, sends a password-reset link instead — "resend invite" to an
// already-active account doesn't make sense, but a forgotten-password
// scenario is common enough to want the same button to handle it.
export async function POST(req, { params }) {
  const auth = await requireOwnerOrAbove()
  if (auth.error) return Response.json({ error: auth.error }, { status: auth.status })

  const { id } = await params

  const { data: target, error: targetError } = await auth.admin
    .from('profiles').select('role, full_name').eq('id', id).single()
  if (targetError || !target) return Response.json({ error: 'User not found' }, { status: 404 })

  if (auth.profile.role === 'owner' && target.role !== 'staff') {
    return Response.json({ error: 'You can only manage staff accounts' }, { status: 403 })
  }

  const { data: authUser, error: authError } = await auth.admin.auth.admin.getUserById(id)
  if (authError || !authUser?.user) return Response.json({ error: 'Account not found in Auth' }, { status: 404 })

  const email = authUser.user.email
  const hasSignedIn = !!authUser.user.last_sign_in_at
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim()
    || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')

  // Already activated → this is a password reset, which legitimately uses
  // Supabase's own short-lived link. Only pending invites get the 5-day token.
  if (hasSignedIn) {
    const { data: linkData, error: linkError } = await auth.admin.auth.admin.generateLink({
      type: 'recovery', email, options: { redirectTo: `${siteUrl}/reset-password` },
    })
    if (linkError) return Response.json({ error: linkError.message }, { status: 400 })

    const emailResult = await sendEmail({
      to: email,
      subject: 'Reset your Ton Mai Spa password',
      html: passwordResetEmailHtml({ fullName: target.full_name, actionLink: linkData.properties.action_link }),
      ignoreTestTo: true,
    })
    if (!emailResult.ok) return Response.json({ error: 'Could not send email' }, { status: 502 })

    return Response.json({ ok: true, type: 'password_reset' })
  }

  // Pending invite → issue a fresh 5-day window and restart the reminder clock,
  // so "Resend" gives the invitee a full 5 days again.
  const inviteExpiresAt = getInviteExpiry()
  let actionLink
  try {
    actionLink = createStaffInviteUrl({ userId: id, email, expiresAt: inviteExpiresAt })
  } catch (err) {
    console.error('[invite] could not sign invite link:', err.message)
    return Response.json({ error: 'Invite link could not be signed. Set STAFF_INVITE_SECRET (or CRON_SECRET) on the server.' }, { status: 503 })
  }

  const { error: updateError } = await auth.admin
    .from('profiles')
    .update({
      invited_at: new Date().toISOString(),
      invite_expires_at: inviteExpiresAt,
      invite_reminder_sent_at: null,
      invite_reminder_count: 0,
    })
    .eq('id', id)
  if (updateError) return Response.json({ error: updateError.message }, { status: 400 })

  const emailResult = await sendEmail({
    to: email,
    subject: "You're invited to the Ton Mai Spa dashboard",
    html: inviteEmailHtml({
      fullName: target.full_name,
      role: target.role,
      actionLink,
      expiresInDays: INVITE_LIFETIME_DAYS,
      expiresAtLabel: formatInviteExpiry(inviteExpiresAt),
    }),
    ignoreTestTo: true,
  })
  if (!emailResult.ok) return Response.json({ error: 'Could not send email' }, { status: 502 })

  return Response.json({ ok: true, type: 'invite', inviteExpiresAt })
}
