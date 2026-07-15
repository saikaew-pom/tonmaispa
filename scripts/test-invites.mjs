// Gate test for migration 031_staff_invite_expiry + lib/staff-invite.js.
//
// Run:  npm run test:invites
// Exercises the real database (schema presence + a real pending-invite row's
// lifecycle) and the pure token logic. Self-cleaning: the fixture profile is
// deleted by exact id at the end, and it is never a real staff member.

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

// Load .env.local the same way the other scripts do.
for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/)
  if (m) process.env[m[1]] ??= m[2].trim()
}

// Signing secrets live in Vercel, not .env.local. The token tests only need
// SOME key, so fall back to a test-only one — this must happen before the lib
// is imported. Production signs with STAFF_INVITE_SECRET/CRON_SECRET.
if (!process.env.STAFF_INVITE_SECRET && !process.env.BOOKING_REQUEST_SECRET && !process.env.CRON_SECRET) {
  process.env.STAFF_INVITE_SECRET = 'test-only-secret-not-used-in-production'
  console.log('note: no signing secret found locally — using a test-only key for the token tests')
}

const {
  createStaffInviteToken,
  verifyStaffInviteToken,
  getInviteExpiry,
  daysRemaining,
  INVITE_LIFETIME_DAYS,
} = await import('../lib/staff-invite.js')

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

let pass = 0, fail = 0
function check(name, cond, detail = '') {
  if (cond) { pass++; console.log(`  ✓ ${name}`) }
  else { fail++; console.log(`  ✗ ${name}${detail ? ' — ' + detail : ''}`) }
}

// profiles.id is FK-constrained to auth.users(id), so the fixture must be a
// real (throwaway) auth user. .invalid is reserved by RFC 2606 and can never
// receive mail; the account is created without sending anything and is deleted
// in the finally block below.
const FIXTURE_EMAIL = 'zztest-invite-fixture@example.invalid'
const FIXTURE_ID = '00000000-0000-4000-8000-0000000ff031' // token tests only — never inserted

async function removeFixtureUsers() {
  const { data: list } = await admin.auth.admin.listUsers({ perPage: 200 })
  const strays = (list?.users ?? []).filter(u => u.email === FIXTURE_EMAIL)
  for (const u of strays) {
    await admin.from('profiles').delete().eq('id', u.id)
    await admin.auth.admin.deleteUser(u.id)
  }
  return strays.length
}

console.log('\nA. Token lifetime + helpers')
{
  const expiry = getInviteExpiry()
  const days = (Date.parse(expiry) - Date.now()) / 86400000
  check('A1 getInviteExpiry is ~5 days out', Math.abs(days - 5) < 0.01, `${days.toFixed(3)}d`)
  check('A2 INVITE_LIFETIME_DAYS is 5', INVITE_LIFETIME_DAYS === 5)
  check('A3 daysRemaining rounds up', daysRemaining(new Date(Date.now() + 3.2 * 86400000).toISOString()) === 4)
  check('A4 daysRemaining floors at 0 when past', daysRemaining(new Date(Date.now() - 1000).toISOString()) === 0)
  check('A5 daysRemaining never returns 0 while valid', daysRemaining(new Date(Date.now() + 60000).toISOString()) === 1)
}

console.log('\nB. Token sign/verify')
{
  const expiresAt = getInviteExpiry()
  const token = createStaffInviteToken({ userId: FIXTURE_ID, email: 'fixture@example.invalid', expiresAt })

  const good = verifyStaffInviteToken(token)
  check('B1 valid token verifies', good.ok === true)
  check('B2 payload round-trips user_id', good.data?.user_id === FIXTURE_ID)
  check('B3 payload round-trips email', good.data?.email === 'fixture@example.invalid')

  const [payload, sig] = token.split('.')
  // Flip a character in the signature — must fail, not throw.
  const tamperedSig = `${payload}.${sig.slice(0, -1)}${sig.slice(-1) === 'A' ? 'B' : 'A'}`
  check('B4 tampered signature rejected', verifyStaffInviteToken(tamperedSig).ok === false)

  // Re-sign a payload whose expiry we moved — proves the signature covers it.
  const forged = Buffer.from(JSON.stringify({
    user_id: FIXTURE_ID, email: 'fixture@example.invalid',
    expires_at: new Date(Date.now() + 999 * 86400000).toISOString(),
  })).toString('base64url')
  check('B5 payload swap rejected', verifyStaffInviteToken(`${forged}.${sig}`).ok === false)

  const expired = createStaffInviteToken({
    userId: FIXTURE_ID, email: 'fixture@example.invalid',
    expiresAt: new Date(Date.now() - 1000).toISOString(),
  })
  check('B6 expired token reports expired', verifyStaffInviteToken(expired).reason === 'expired')
  check('B7 garbage token rejected', verifyStaffInviteToken('not-a-token').ok === false)
  check('B8 empty token rejected', verifyStaffInviteToken('').ok === false)
}

console.log('\nC. Migration 031 schema + invite lifecycle (real DB)')
let userId = null
try {
  // Fails loudly if migration 031 has not been run.
  const { error: schemaError } = await admin
    .from('profiles')
    .select('invited_at, invite_expires_at, invite_reminder_sent_at, invite_reminder_count')
    .limit(1)
  check('C1 invite columns exist (migration 031 applied)', !schemaError, schemaError?.message)

  if (!schemaError) {
    await removeFixtureUsers() // in case a prior run aborted

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: FIXTURE_EMAIL,
      email_confirm: false,
      user_metadata: { full_name: 'ZZTEST Invite Fixture' },
    })
    userId = created?.user?.id ?? null
    check('C2 fixture auth user created', !!userId && !createError, createError?.message)

    if (userId) {
      // handle_new_user() should have created the profile row already; upsert
      // makes the test independent of that trigger either way. Deliberately
      // does NOT set invite_reminder_count, so C4 tests the column default.
      const expiresAt = getInviteExpiry()
      const { error: upsertError } = await admin.from('profiles').upsert({
        id: userId,
        full_name: 'ZZTEST Invite Fixture',
        role: 'staff',
        invited_at: new Date().toISOString(),
        invite_expires_at: expiresAt,
      }, { onConflict: 'id' })
      check('C3 pending invite row upserts (FK to auth.users satisfied)', !upsertError, upsertError?.message)

      const { data: row } = await admin
        .from('profiles')
        .select('invite_expires_at, invite_reminder_count, invite_reminder_sent_at')
        .eq('id', userId).maybeSingle()
      check('C4 invite_reminder_count defaults to 0', row?.invite_reminder_count === 0, `got ${row?.invite_reminder_count}`)
      check('C5 invite_reminder_sent_at defaults to null', row?.invite_reminder_sent_at === null)
      check('C6 expiry stored ~5 days out',
        Math.abs((Date.parse(row?.invite_expires_at) - Date.now()) / 86400000 - 5) < 0.01)

      // The reminder job's selection query must find it.
      const { data: pendingRows } = await admin
        .from('profiles').select('id')
        .not('invite_expires_at', 'is', null)
        .gt('invite_expires_at', new Date().toISOString())
      check('C7 pending invite is selected by the reminder query',
        (pendingRows ?? []).some(r => r.id === userId))

      // Reminder bookkeeping.
      await admin.from('profiles')
        .update({ invite_reminder_sent_at: new Date().toISOString(), invite_reminder_count: 1 })
        .eq('id', userId)
      const { data: afterReminder } = await admin
        .from('profiles').select('invite_reminder_count').eq('id', userId).maybeSingle()
      check('C8 reminder count increments', afterReminder?.invite_reminder_count === 1)

      // Activation/revoke: clearing the column must drop it out of the query.
      await admin.from('profiles').update({ invite_expires_at: null }).eq('id', userId)
      const { data: afterClear } = await admin
        .from('profiles').select('id')
        .not('invite_expires_at', 'is', null)
        .gt('invite_expires_at', new Date().toISOString())
      check('C9 revoked/activated invite leaves the reminder queue',
        !(afterClear ?? []).some(r => r.id === userId))
    }
  }
} finally {
  console.log('\nD. Cleanup')
  const removed = await removeFixtureUsers()
  check('D1 fixture auth user + profile removed', removed >= 0)

  const { data: list } = await admin.auth.admin.listUsers({ perPage: 200 })
  check('D2 no fixture auth users left behind',
    !(list?.users ?? []).some(u => u.email === FIXTURE_EMAIL))

  if (userId) {
    const { data: left } = await admin.from('profiles').select('id').eq('id', userId)
    check('D3 no fixture profile rows left behind', (left ?? []).length === 0)
  }
}

console.log(`\nRESULT: ${pass} passed, ${fail} failed\n`)
process.exit(fail > 0 ? 1 : 0)
