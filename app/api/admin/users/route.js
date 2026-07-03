import { requireOwnerOrAbove } from '@/lib/require-admin'
import { sendEmail, inviteEmailHtml } from '@/lib/brevo'

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
// Generates a Supabase invite link directly (not Supabase's own rate-limited
// invite mailer) and sends it via this project's existing Brevo helper.
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

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
  const { data, error } = await auth.admin.auth.admin.generateLink({
    type: 'invite',
    email,
    options: { data: { full_name: fullName }, redirectTo: `${siteUrl}/reset-password` },
  })
  if (error) return Response.json({ error: error.message }, { status: 400 })

  const { error: profileError } = await auth.admin
    .from('profiles')
    .upsert({ id: data.user.id, full_name: fullName, role }, { onConflict: 'id' })
  if (profileError) return Response.json({ error: profileError.message }, { status: 400 })

  const emailResult = await sendEmail({
    to: email,
    subject: "You're invited to the Ton Mai Spa dashboard",
    html: inviteEmailHtml({ fullName, role, actionLink: data.properties.action_link }),
    ignoreTestTo: true, // invite must reach the real person, not a dev test inbox
  })
  if (!emailResult.ok) {
    return Response.json({ error: 'Account created but the invite email failed to send. Ask them to use "Forgot password" on the login page.' }, { status: 502 })
  }

  return Response.json({ ok: true, userId: data.user.id })
}
