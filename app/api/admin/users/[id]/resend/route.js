import { requireOwnerOrAbove } from '@/lib/require-admin'
import { sendEmail, inviteEmailHtml, passwordResetEmailHtml } from '@/lib/brevo'

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
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL

  const { data: linkData, error: linkError } = await auth.admin.auth.admin.generateLink(
    hasSignedIn
      ? { type: 'recovery', email, options: { redirectTo: `${siteUrl}/reset-password` } }
      : { type: 'invite', email, options: { data: { full_name: target.full_name }, redirectTo: `${siteUrl}/reset-password` } }
  )
  if (linkError) return Response.json({ error: linkError.message }, { status: 400 })

  const emailResult = await sendEmail({
    to: email,
    subject: hasSignedIn ? 'Reset your Ton Mai Spa password' : "You're invited to the Ton Mai Spa dashboard",
    html: hasSignedIn
      ? passwordResetEmailHtml({ fullName: target.full_name, actionLink: linkData.properties.action_link })
      : inviteEmailHtml({ fullName: target.full_name, role: target.role, actionLink: linkData.properties.action_link }),
    ignoreTestTo: true,
  })
  if (!emailResult.ok) return Response.json({ error: 'Could not send email' }, { status: 502 })

  return Response.json({ ok: true, type: hasSignedIn ? 'password_reset' : 'invite' })
}
