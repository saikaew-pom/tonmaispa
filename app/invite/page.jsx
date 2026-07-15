// GET /invite?token=... — the durable (5-day) staff invitation landing.
//
// The emailed link points here, not at Supabase. Supabase's own link expires
// in 24h, so we hold the 5-day validity in our own HMAC token and only mint a
// short-lived Supabase link at the moment the invitee clicks — then hand them
// straight to it. The invitee never sees this page unless something is wrong.

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createSupabaseAdminClient } from '@/lib/supabase-admin'
import { verifyStaffInviteToken } from '@/lib/staff-invite'

export const dynamic = 'force-dynamic'

const MESSAGES = {
  invalid: {
    title: 'This invitation link is not valid',
    body: 'The link may have been copied incompletely. Please open it directly from the email, or ask your manager to send a new invitation.',
  },
  expired: {
    title: 'This invitation has expired',
    body: 'Invitations are valid for 5 days. Please ask your manager to send you a new one — it only takes them a moment.',
  },
  revoked: {
    title: 'This invitation is no longer active',
    body: 'It was either cancelled or replaced by a newer invitation. Please check for a more recent email, or ask your manager to send a new one.',
  },
  already_active: {
    title: 'Your account is already set up',
    body: 'This invitation has already been used. You can log in with your email and password — or use "Forgot password" if you need to reset it.',
  },
  misconfigured: {
    title: 'We cannot open invitations right now',
    body: 'This is a configuration problem on our side, not with your link. Please let your manager know so they can contact the site administrator.',
  },
}

async function resolveInvite(token) {
  const verified = verifyStaffInviteToken(token)
  if (!verified.ok) return { ok: false, reason: verified.reason }

  const { user_id: userId, email } = verified.data
  const admin = createSupabaseAdminClient()

  // The token proves the link is ours and unexpired; the DB decides whether the
  // invitation is still outstanding. Clearing invite_expires_at revokes it.
  const { data: profile } = await admin
    .from('profiles')
    .select('id, full_name, role, is_active, invite_expires_at')
    .eq('id', userId)
    .maybeSingle()

  if (!profile || profile.is_active === false) return { ok: false, reason: 'revoked' }
  if (!profile.invite_expires_at) return { ok: false, reason: 'revoked' }
  if (Date.parse(profile.invite_expires_at) <= Date.now()) return { ok: false, reason: 'expired' }

  const { data: authUser } = await admin.auth.admin.getUserById(userId)
  if (!authUser?.user) return { ok: false, reason: 'revoked' }
  if (authUser.user.last_sign_in_at) return { ok: false, reason: 'already_active' }

  // The DB authorises by user_id, but generateLink resolves by EMAIL — and when
  // no user matches that address it does not fail, it silently signs up a new
  // one (GoTrue mail.go adminGenerateLink: `else { createdUser = true; user =
  // a.signupNewUser(...) }`). So if this account's email changed after the token
  // was minted, minting on the token's stale address would create a stray
  // account and hand the invitee credentials to it instead of to their own.
  // Authorise and mint against the same principal: the account's current email.
  // Compared case-insensitively because GoTrue normalises addresses to
  // lowercase, while the token may carry whatever case the admin typed.
  const currentEmail = authUser.user.email
  if (!currentEmail || currentEmail.toLowerCase() !== String(email).toLowerCase()) {
    return { ok: false, reason: 'revoked' }
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim()
    || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')

  // Mint the short-lived Supabase link now, at click time, and spend it
  // immediately by redirecting the invitee into Supabase's own password flow.
  const { data: linkData, error } = await admin.auth.admin.generateLink({
    type: 'invite',
    email: currentEmail,
    options: { data: { full_name: profile.full_name }, redirectTo: `${siteUrl}/reset-password` },
  })
  if (error || !linkData?.properties?.action_link) {
    console.error('[invite] generateLink failed:', error?.message)
    return { ok: false, reason: 'misconfigured' }
  }

  return { ok: true, actionLink: linkData.properties.action_link }
}

export default async function InvitePage({ searchParams }) {
  const params = await searchParams
  const result = await resolveInvite(params?.token)

  // redirect() throws NEXT_REDIRECT — must stay outside any try/catch.
  if (result.ok) redirect(result.actionLink)

  const message = MESSAGES[result.reason] ?? MESSAGES.invalid

  return (
    <main style={{ minHeight: '100vh', background: '#F5F1E8', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ maxWidth: 480, width: '100%', background: '#fff', borderRadius: 10, overflow: 'hidden', boxShadow: '0 10px 40px -20px rgba(28,25,23,0.35)' }}>
        <div style={{ background: '#3B5249', padding: '24px 32px' }}>
          <h1 style={{ color: '#FAF6F0', margin: 0, font: '600 20px Inter,sans-serif' }}>Ton Mai Spa</h1>
        </div>
        <div style={{ padding: 32 }}>
          <h2 style={{ margin: '0 0 12px', font: '600 18px Inter,sans-serif', color: '#1C1917' }}>{message.title}</h2>
          <p style={{ margin: '0 0 24px', font: '400 14px/1.6 Inter,sans-serif', color: '#5A5550' }}>{message.body}</p>
          <Link
            href="/login"
            style={{ display: 'inline-block', background: '#3B5249', color: '#FAF6F0', padding: '12px 24px', borderRadius: 6, textDecoration: 'none', font: '600 14px Inter,sans-serif' }}
          >
            Go to login
          </Link>
        </div>
      </div>
    </main>
  )
}
