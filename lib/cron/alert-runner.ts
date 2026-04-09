import { createClient } from '@supabase/supabase-js'
import { searchSerper } from '@/lib/search/serper'
import { buildSearchQueries, buildShoppingQuery } from '@/lib/search/query-builder'
import {
  detectFromOrganic,
  detectFromShopping,
  contentHash,
} from '@/lib/search/promotion-detector'
import { dispatchNotifications } from '@/lib/notifications/dispatcher'
import { validateAll } from '@/lib/search/validator'
import type { Alert, Profile } from '@/types'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )
}

const BATCH_SIZE = parseInt(process.env.SEARCH_BATCH_SIZE ?? '10', 10)

export async function runDueAlerts(): Promise<{ processed: number; errors: string[] }> {
  const supabase = getSupabase()
  const now = new Date().toISOString()
  const today = now.slice(0, 10)

  const { data: alerts, error } = await supabase
    .from('alerts')
    .select('*')
    .eq('is_active', true)
    .lte('next_run_at', now)
    .lte('start_date', today)
    .gte('end_date', today)
    .order('next_run_at', { ascending: true })
    .limit(BATCH_SIZE)

  if (error) throw new Error(`Failed to fetch alerts: ${error.message}`)
  if (!alerts || alerts.length === 0) return { processed: 0, errors: [] }

  const errors: string[] = []
  let processed = 0

  for (const alert of alerts as Alert[]) {
    try {
      await processAlert(alert)
      processed++
    } catch (err) {
      errors.push(`Alert ${alert.id}: ${String(err)}`)
    }
  }

  return { processed, errors }
}

async function processAlert(alert: Alert) {
  const supabase = getSupabase()

  // 1. Run searches
  const queries = buildSearchQueries(alert)
  const shoppingQuery = buildShoppingQuery(alert)

  const [organicResults, shoppingResults] = await Promise.all([
    searchSerper(queries[0]).catch(() => ({ organic: [], shopping: [] })),
    searchSerper(shoppingQuery, 'shopping').catch(() => ({ organic: [], shopping: [] })),
  ])

  // 2. Detect promotions
  const organicPromos = detectFromOrganic(organicResults.organic, alert.id)
  const shoppingPromos = detectFromShopping(shoppingResults.shopping ?? [], alert.id)
  const rawDetected = [...organicPromos, ...shoppingPromos]

  // 3. Validate with LLM (filters invalid links and fake coupons)
  const productQuery = alert.search_query ?? alert.label
  const allDetected = process.env.ANTHROPIC_API_KEY
    ? await validateAll(rawDetected, productQuery)
    : rawDetected

  // 4. Persist (deduped by content_hash)
  const rows = allDetected.map((p) => {
    const v = 'validation' in p ? (p as { validation: { coupon_code: string | null; price: number | null; discount_pct: number | null } }).validation : null
    return {
      alert_id: alert.id,
      source_url: p.source_url,
      title: p.title,
      snippet: p.snippet,
      coupon_code: v?.coupon_code ?? p.coupon_code,
      price: v?.price ?? p.price,
      original_price: p.original_price,
      discount_pct: v?.discount_pct ?? p.discount_pct,
      content_hash: contentHash(alert.id, p.source_url, p.title),
    }
  })

  if (rows.length > 0) {
    await supabase
      .from('promotions')
      .upsert(rows, { onConflict: 'alert_id,content_hash', ignoreDuplicates: true })
  }

  // 4. Fetch pending (unnotified) promotions
  const { data: pending } = await supabase
    .from('promotions')
    .select('*')
    .eq('alert_id', alert.id)
    .is('notified_at', null)

  // 5. Fetch user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', alert.user_id)
    .single()

  if (pending && pending.length > 0 && profile) {
    await dispatchNotifications(alert, pending, profile as Profile)
  }

  // 6. Schedule next run
  const nextRun = new Date(Date.now() + alert.frequency_hours * 60 * 60 * 1000).toISOString()
  await supabase
    .from('alerts')
    .update({ last_run_at: new Date().toISOString(), next_run_at: nextRun })
    .eq('id', alert.id)
}
