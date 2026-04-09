import { createClient } from '@supabase/supabase-js'
import { sendPromotionEmail } from './email'
import { sendPromotionWhatsapp } from './whatsapp'
import type { Alert, Promotion, Profile } from '@/types'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function dispatchNotifications(
  alert: Alert,
  promotions: Promotion[],
  profile: Profile
): Promise<void> {
  if (promotions.length === 0) return

  const pending = promotions.filter((p) => !p.notified_at)
  if (pending.length === 0) return

  const tasks: Promise<void>[] = []

  if (profile.notify_email && profile.email) {
    tasks.push(
      sendPromotionEmail(profile.email, alert, pending)
        .then((id) => logNotification(pending, 'email', 'sent', id))
        .catch((err) => logNotification(pending, 'email', 'failed', null, String(err)))
    )
  }

  if (profile.notify_whatsapp && profile.whatsapp) {
    tasks.push(
      sendPromotionWhatsapp(profile.whatsapp, alert, pending)
        .then((id) => logNotification(pending, 'whatsapp', 'sent', id))
        .catch((err) => logNotification(pending, 'whatsapp', 'failed', null, String(err)))
    )
  }

  await Promise.all(tasks)

  // Mark promotions as notified
  const supabase = getSupabase()
  await supabase
    .from('promotions')
    .update({ notified_at: new Date().toISOString() })
    .in('id', pending.map((p) => p.id))
}

async function logNotification(
  promotions: Promotion[],
  channel: 'email' | 'whatsapp',
  status: 'sent' | 'failed',
  providerId: string | null,
  errorMessage?: string
) {
  const supabase = getSupabase()
  const logs = promotions.map((p) => ({
    promotion_id: p.id,
    channel,
    status,
    provider_id: providerId,
    error_message: errorMessage ?? null,
  }))

  await supabase.from('notification_logs').insert(logs)
}
