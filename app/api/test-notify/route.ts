import { NextResponse } from 'next/server'
import { sendPromotionEmail } from '@/lib/notifications/email'
import { sendPromotionWhatsapp } from '@/lib/notifications/whatsapp'
import type { Alert, Promotion } from '@/types'

// Remove this file before going to production!

const fakeAlert: Alert = {
  id: 'test-alert-id',
  user_id: 'test-user',
  label: 'Samsung TV 55 OLED',
  search_query: 'Samsung TV 55 OLED',
  product_url: null,
  start_date: '2026-04-09',
  end_date: '2026-04-16',
  frequency_hours: 6,
  is_active: true,
  last_run_at: null,
  next_run_at: null,
  created_at: new Date().toISOString(),
}

const fakePromo: Promotion = {
  id: 'test-promo-id',
  alert_id: 'test-alert-id',
  source_url: 'https://www.pelando.com.br/samsung-tv-55-oled',
  title: 'Samsung TV 55" OLED 4K com 30% OFF',
  snippet: 'Oferta por tempo limitado. Use o cupom e economize!',
  coupon_code: 'OLED30OFF',
  price: 3499.99,
  original_price: 4999.99,
  discount_pct: 30,
  found_at: new Date().toISOString(),
  notified_at: null,
  content_hash: 'test-hash',
}

export async function POST(request: Request) {
  const { email, whatsapp } = await request.json()
  const results: Record<string, string> = {}

  if (email) {
    try {
      const id = await sendPromotionEmail(email, fakeAlert, [fakePromo])
      results.email = `ok (id: ${id})`
    } catch (err) {
      results.email = `erro: ${String(err)}`
    }
  }

  if (whatsapp) {
    try {
      const id = await sendPromotionWhatsapp(whatsapp, fakeAlert, [fakePromo])
      results.whatsapp = `ok (id: ${id})`
    } catch (err) {
      results.whatsapp = `erro: ${String(err)}`
    }
  }

  return NextResponse.json(results)
}
