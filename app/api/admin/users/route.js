import { requireOwnerOrAbove } from '@/lib/require-admin'
import { sendEmail, inviteEmailHtml } from '@/lib/brevo'
import {
  createStaffInviteUrl,
  getInviteExpiry,
  formatInviteExpiry,
  INVITE_LIFETIME_DAYS,
} from '@/lib/staff-invite'

const ROLES_A_ROLE_CAN_GRANT = {
  super_admin: ['super_admin', 'owner', 'staff'],
  owner: ['staff'],
}

// GET /api/admin/users — list accounts.
// super_admin sees everyone; owner sees only staff accounts (their own
// scope of responsibility — matches the permission matrix in the plan).
export async function GET() {
  const auth = await requireOwnerOrAbove()
  if (auth.error) return Response.json({ error: auth.error }, { status: auth.status })

  let query = auth.admin.from('profiles').select('id, full_name, role, is_active, created_at').order('created_at', { ascending: false })
  if (auth.profile.role === 'owner') query = query.eq('role', 'staff')

  const { data, error } = await query
  if (error) return Response.json({ error: error.message }, { status: 400 })

  // Email + signup status live in auth.users, not profiles — fetch via the
  // admin API rather than duplicating them into profiles. hasSignedIn drives
  // whether "Resend" sends a fresh invite or a password-reset link.
  const { data: authUsers } = await auth.admin.auth.admin.listUsers({ perPage: 200 })
  const authById = Object.fromEntries((authUsers?.users ?? []).map(u => [u.id, u]))

  return Response.json({
    users: (data ?? []).map(u => ({
      ...u,
      email: authById[u.id]?.email ?? null,
      hasSignedIn: !!authById[u.id]?.last_sign_in_at,
    })),
  })
}

// POST /api/admin/users — { email, fullName, role }
// Creates the auth user, then emails OUR durable 5-day invite link (Supabase's
// own link is capped at 24h — see lib/staff-invite.js) via Brevo. The invitee
// exchanges that link for a fresh Supabase link when they click it.
export async function POST(req) {
  const auth = await requireOwnerOrAbove()
  if (auth.error) return Response.json({ error: auth.error }, { status: auth.status })

  const { email, fullName, role } = await req.json()
  if (!email || !fullName || !role) {
    return Response.json({ error: 'email, fullName, and role are required' }, { status: 400 })
  }

  const grantable = ROLES_A_ROLE_CAN_GRANT[auth.profile.role] ?? []
  if (!grantable.includes(role)) {
    return Response.json({ error: `You are not allowed to create a "${role}" account` }, { status: 403 })
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim()
    || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')

  // generateLink is still how the auth user gets created; its own action_link
  // is deliberately discarded — it would expire in 24h. Ours lasts 5 days.
  const { data, error } = await auth.admin.auth.admin.generateLink({
    type: 'invite',
    email,
    options: { data: { full_name: fullName }, redirectTo: `${siteUrl}/reset-password` },
  })
  if (error) return Response.json({ error: error.message }, { status: 400 })

  const invitedAt = new Date().toISOString()
  const inviteExpiresAt = getInviteExpiry()

  const { error: profileError } = await auth.admin
    .from('profiles')
    .upsert({
      id: data.user.id,
      full_name: fullName,
      role,
      invited_at: invitedAt,
      invite_expires_at: inviteExpiresAt,
      invite_reminder_sent_at: null,
      invite_reminder_count: 0,
    }, { onConflict: 'id' })
  if (profileError) return Response.json({ error: profileError.message }, { status: 400 })

  let actionLink
  try {
    // Sign the address Supabase actually stored (it normalises to lowercase),
    // not the raw one typed above — /invite binds the token's email to the
    // account's current email, and the resend route and reminder job both
    // already use the canonical auth.users value.
    actionLink = createStaffInviteUrl({
      userId: data.user.id,
      email: data.user.email ?? email,
      expiresAt: inviteExpiresAt,
    })
  } catch (err) {
    console.error('[invite] could not sign invite link:', err.message)
    return Response.json({ error: 'Account created but the invite link could not be signed. Set STAFF_INVITE_SECRET (or CRON_SECRET) and use Resend.' }, { status: 503 })
  }

  const emailResult = await sendEmail({
    to: email,
    subject: "You're invited to the Ton Mai Spa dashboard",
    html: inviteEmailHtml({
      fullName,
      role,
      actionLink,
      expiresInDays: INVITE_LIFETIME_DAYS,
      expiresAtLabel: formatInviteExpiry(inviteExpiresAt),
    }),
    ignoreTestTo: true, // invite must reach the real person, not a dev test inbox
  })
  if (!emailResult.ok) {
    return Response.json({ error: 'Account created but the invite email failed to send. Use Resend, or ask them to use "Forgot password" on the login page.' }, { status: 502 })
  }

  return Response.json({ ok: true, userId: data.user.id, inviteExpiresAt })
}
