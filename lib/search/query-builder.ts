import type { Alert } from '@/types'

export function buildSearchQueries(alert: Alert): string[] {
  const queries: string[] = []

  if (alert.product_url) {
    try {
      const domain = new URL(alert.product_url).hostname
      queries.push(`cupom OR promoção OR desconto site:${domain}`)
      queries.push(`coupon OR deal OR promo site:${domain}`)
    } catch {
      // malformed URL — fall through to search_query
    }
  }

  if (alert.search_query) {
    queries.push(`"${alert.search_query}" cupom OR promoção OR desconto OR oferta`)
    queries.push(`"${alert.search_query}" coupon OR deal OR discount`)
  }

  return queries
}

export function buildShoppingQuery(alert: Alert): string {
  if (alert.search_query) return alert.search_query
  return alert.label
}
