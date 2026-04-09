export interface Profile {
  id: string
  email: string | null
  whatsapp: string | null
  notify_email: boolean
  notify_whatsapp: boolean
  created_at: string
}

export interface Alert {
  id: string
  user_id: string
  label: string
  search_query: string | null
  product_url: string | null
  start_date: string // ISO date YYYY-MM-DD
  end_date: string
  frequency_hours: number
  is_active: boolean
  last_run_at: string | null
  next_run_at: string | null
  created_at: string
}

export interface Promotion {
  id: string
  alert_id: string
  source_url: string
  title: string
  snippet: string | null
  coupon_code: string | null
  price: number | null
  original_price: number | null
  discount_pct: number | null
  found_at: string
  notified_at: string | null
  content_hash: string
}

export interface NotificationLog {
  id: string
  promotion_id: string
  channel: 'email' | 'whatsapp'
  status: 'sent' | 'failed'
  provider_id: string | null
  error_message: string | null
  sent_at: string
}

export type AlertWithStats = Alert & {
  promotions_count?: number
  latest_promotion?: Promotion | null
}
