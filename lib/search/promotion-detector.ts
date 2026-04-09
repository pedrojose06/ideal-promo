import crypto from 'crypto'
import type { SerperOrganicResult, SerperShoppingResult } from './serper'

const PROMO_DOMAINS = new Set([
  'pelando.com.br',
  'promobit.com.br',
  'cuponomia.com.br',
  'melhoresdescontos.com.br',
  'meliuz.com.br',
  'zoom.com.br',
  'buscapé.com.br',
  'buscape.com.br',
  'slickdeals.net',
  'retailmenot.com',
])

const COUPON_PATTERN = /\b([A-Z0-9]{4,16})\b/g
const PRICE_BRL = /R\$\s?([\d.,]+)/i
const PRICE_USD = /\$([\d.,]+)/
const DISCOUNT_PCT = /(\d{1,3})%\s*(off|desconto|de desconto|discount)/i

export interface DetectedPromotion {
  source_url: string
  title: string
  snippet: string | null
  coupon_code: string | null
  price: number | null
  original_price: number | null
  discount_pct: number | null
  score: number
}

function scoreOrganic(result: SerperOrganicResult): number {
  let score = 0
  const text = `${result.title} ${result.snippet ?? ''}`.toLowerCase()

  // Known promo domain
  try {
    const domain = new URL(result.link).hostname.replace('www.', '')
    if (PROMO_DOMAINS.has(domain)) score += 15
  } catch { /* skip */ }

  // Promo keywords
  if (/promo|oferta|desconto|cupom|promoção/i.test(text)) score += 20
  if (/coupon|deal|discount|sale/i.test(text)) score += 15

  // Discount percentage
  if (DISCOUNT_PCT.test(text)) score += 30

  // Price mention
  if (PRICE_BRL.test(text) || PRICE_USD.test(text)) score += 15

  // Coupon code pattern (all-caps alphanum, 4-16 chars)
  const codes = text.toUpperCase().match(COUPON_PATTERN)
  if (codes && codes.length > 0) score += 40

  // Recent result
  if (result.date) {
    const daysAgo = (Date.now() - new Date(result.date).getTime()) / (1000 * 60 * 60 * 24)
    if (daysAgo <= 2) score += 10
  }

  return score
}

function extractCouponCode(text: string): string | null {
  // Look for codes near coupon keywords
  const couponCtx = /(?:use|código|code|cupom|coupon)[:\s]+([A-Z0-9]{4,16})/i.exec(text)
  if (couponCtx) return couponCtx[1].toUpperCase()

  // Standalone uppercase alphanum pattern
  const match = /\b([A-Z]{2,}[0-9]{2,}|[0-9]{2,}[A-Z]{2,})\b/.exec(text)
  return match ? match[1] : null
}

function extractPrice(text: string): number | null {
  const m = PRICE_BRL.exec(text) ?? PRICE_USD.exec(text)
  if (!m) return null
  return parseFloat(m[1].replace(/\./g, '').replace(',', '.'))
}

function extractDiscountPct(text: string): number | null {
  const m = DISCOUNT_PCT.exec(text)
  return m ? parseInt(m[1], 10) : null
}

export function detectFromOrganic(
  results: SerperOrganicResult[],
  alertId: string,
  threshold = 30
): DetectedPromotion[] {
  const out: DetectedPromotion[] = []
  for (const r of results) {
    const score = scoreOrganic(r)
    if (score < threshold) continue
    const fullText = `${r.title} ${r.snippet ?? ''}`
    out.push({
      source_url: r.link,
      title: r.title,
      snippet: r.snippet ?? null,
      coupon_code: extractCouponCode(fullText),
      price: extractPrice(fullText),
      original_price: null,
      discount_pct: extractDiscountPct(fullText),
      score,
    })
  }
  return out
}

export function detectFromShopping(
  results: SerperShoppingResult[],
  alertId: string
): DetectedPromotion[] {
  return results
    .filter((r) => r.price)
    .map((r) => ({
      source_url: r.link,
      title: r.title,
      snippet: `${r.source} — ${r.price}`,
      coupon_code: null,
      price: extractPrice(r.price),
      original_price: null,
      discount_pct: null,
      score: 25, // shopping results are always relevant
    }))
}

export function contentHash(alertId: string, sourceUrl: string, title: string): string {
  return crypto
    .createHash('sha256')
    .update(`${alertId}:${sourceUrl}:${title}`)
    .digest('hex')
}
