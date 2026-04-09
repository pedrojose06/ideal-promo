import type { DetectedPromotion } from './promotion-detector'

const FETCH_TIMEOUT_MS = 8000
const MAX_PAGE_CHARS = 15000

export interface ValidationResult {
  valid: boolean
  reason: string
  coupon_code: string | null
  price: number | null
  discount_pct: number | null
  confidence: 'high' | 'medium' | 'low'
}

const PROMO_KEYWORDS = [
  'cupom', 'coupon', 'desconto', 'discount', 'promoção', 'promocao',
  'oferta', 'sale', 'deal', 'off', 'economia', 'economize',
]

const EXPIRED_KEYWORDS = [
  'expirado', 'expired', 'encerrado', 'ended', 'unavailable',
  'não disponível', 'esgotado', 'out of stock', 'página não encontrada',
  '404', 'not found',
]

const PRICE_BRL = /R\$\s?([\d.,]+)/gi
const PRICE_USD = /\$([\d.,]+)/g
const DISCOUNT_PCT = /(\d{1,3})\s*%\s*(off|desconto|de desconto|discount)/gi
const COUPON_NEAR_KEYWORDS = /(?:use|código|code|cupom|coupon|promo)[:\s]+([A-Z0-9]{4,16})/gi

async function fetchPageText(url: string): Promise<{ text: string; status: number } | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
      },
    })

    if (!res.ok) return { text: '', status: res.status }

    const html = await res.text()
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, MAX_PAGE_CHARS)
      .toLowerCase()

    return { text, status: res.status }
  } catch {
    return null
  }
}

function extractPrice(text: string): number | null {
  const matches = [...text.matchAll(PRICE_BRL)]
  if (matches.length > 0) {
    const val = matches[0][1].replace(/\./g, '').replace(',', '.')
    const num = parseFloat(val)
    return isNaN(num) ? null : num
  }
  return null
}

function extractDiscount(text: string): number | null {
  const match = DISCOUNT_PCT.exec(text)
  DISCOUNT_PCT.lastIndex = 0
  return match ? parseInt(match[1], 10) : null
}

function extractCoupon(text: string, hintCode: string | null): string | null {
  // First try to find code near coupon keywords
  const match = COUPON_NEAR_KEYWORDS.exec(text)
  COUPON_NEAR_KEYWORDS.lastIndex = 0
  if (match) return match[1].toUpperCase()

  // If we have a hint code, check if it appears in the page
  if (hintCode && text.includes(hintCode.toLowerCase())) {
    return hintCode.toUpperCase()
  }

  return null
}

function containsProductKeywords(text: string, productQuery: string): boolean {
  const words = productQuery.toLowerCase().split(/\s+/).filter((w) => w.length > 3)
  const matchCount = words.filter((w) => text.includes(w)).length
  return matchCount >= Math.ceil(words.length * 0.5) // at least 50% of keywords present
}

export async function validatePromotion(
  promo: DetectedPromotion,
  productQuery: string
): Promise<ValidationResult> {
  const result = await fetchPageText(promo.source_url)

  // Link inaccessible
  if (!result) {
    return {
      valid: false,
      reason: 'Link inacessível (timeout ou erro de rede)',
      coupon_code: null, price: null, discount_pct: null, confidence: 'low',
    }
  }

  // HTTP error
  if (result.status >= 400) {
    return {
      valid: false,
      reason: `Link retornou erro HTTP ${result.status}`,
      coupon_code: null, price: null, discount_pct: null, confidence: 'low',
    }
  }

  const text = result.text

  // Page signals expiry
  const isExpired = EXPIRED_KEYWORDS.some((kw) => text.includes(kw))
  if (isExpired) {
    return {
      valid: false,
      reason: 'Página indica promoção expirada ou produto indisponível',
      coupon_code: null, price: null, discount_pct: null, confidence: 'high',
    }
  }

  // Check if page is related to the product
  const hasProduct = containsProductKeywords(text, productQuery)

  // Check for promo signals on page
  const hasPromoSignal = PROMO_KEYWORDS.some((kw) => text.includes(kw))

  // Extract data from actual page content
  const couponCode = extractCoupon(text, promo.coupon_code)
  const price = extractPrice(text) ?? promo.price
  const discountPct = extractDiscount(text) ?? promo.discount_pct

  // Score the result
  let score = 0
  if (hasProduct) score += 40
  if (hasPromoSignal) score += 20
  if (couponCode) score += 30
  if (discountPct) score += 20
  if (price) score += 10

  if (score < 40) {
    return {
      valid: false,
      reason: 'Página não tem sinais suficientes de promoção relacionada ao produto',
      coupon_code: null, price: null, discount_pct: null, confidence: 'medium',
    }
  }

  const confidence = score >= 80 ? 'high' : score >= 50 ? 'medium' : 'low'

  return {
    valid: true,
    reason: `Promoção validada (score: ${score})`,
    coupon_code: couponCode,
    price,
    discount_pct: discountPct,
    confidence,
  }
}

export async function validateAll(
  promos: DetectedPromotion[],
  productQuery: string,
  concurrency = 3
): Promise<Array<DetectedPromotion & { validation: ValidationResult }>> {
  const results: Array<DetectedPromotion & { validation: ValidationResult }> = []

  for (let i = 0; i < promos.length; i += concurrency) {
    const batch = promos.slice(i, i + concurrency)
    const validated = await Promise.all(
      batch.map(async (p) => ({
        ...p,
        validation: await validatePromotion(p, productQuery),
      }))
    )
    results.push(...validated)
  }

  return results.filter((p) => p.validation.valid)
}
