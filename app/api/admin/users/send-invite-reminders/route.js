// Daily reminder for staff who were invited but haven't activated yet.
//
// The job itself lives in lib/staff-invite-reminders.js. This route gives it a
// manual trigger and a cron entry point. Because the Vercel account is on the
// Hobby plan (2 cron jobs, both already used by the booking jobs), the daily
// run is currently driven from the send-followups cron handler — see the note
// there. On Pro, give this route its own entry in vercel.json instead.

import { requireOwnerOrAbove } from '@/lib/require-admin'
import { createSupabaseAdminClient } from '@/lib/supabase-admin'
import { runInviteReminderSend } from '@/lib/staff-invite-reminders'

// POST — manual trigger from the dashboard (owner or above).
export async function POST() {
  const auth = await requireOwnerOrAbove()
  if (auth.error) return Response.json({ error: auth.error }, { status: auth.status })

  try {
    return Response.json(await runInviteReminderSend({ admin: auth.admin }))
  } catch (error) {
    return Response.json({ error: error.message || 'Could not send invite reminders.' }, { status: error.status || 500 })
  }
}

// GET — cron entry point. Requires Authorization: Bearer <CRON_SECRET>.
export async function GET(req) {
  const secret = process.env.CRON_SECRET?.trim()
  if (!secret) return Response.json({ error: 'CRON_SECRET is not configured.' }, { status: 503 })

  const authHeader = req.headers.get('authorization') || ''
  if (authHeader !== `Bearer ${secret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    return Response.json(await runInviteReminderSend({ admin: createSupabaseAdminClient() }))
  } catch (error) {
    return Response.json({ error: error.message || 'Could not send invite reminders.' }, { status: error.status || 500 })
  }
}
