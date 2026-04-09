import Anthropic from '@anthropic-ai/sdk'
import type { DetectedPromotion } from './promotion-detector'

const FETCH_TIMEOUT_MS = 8000
const MAX_PAGE_CHARS = 6000

export interface ValidationResult {
  valid: boolean
  reason: string
  coupon_code: string | null   // refined by LLM
  price: number | null          // refined by LLM
  discount_pct: number | null   // refined by LLM
  confidence: 'high' | 'medium' | 'low'
}

function getClient() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
}

async function fetchPageText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ideal-promo-bot/1.0)' },
    })

    if (!res.ok) return null

    const html = await res.text()
    // Strip HTML tags and collapse whitespace
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, MAX_PAGE_CHARS)

    return text
  } catch {
    return null
  }
}

export async function validatePromotion(
  promo: DetectedPromotion,
  productQuery: string
): Promise<ValidationResult> {
  const pageText = await fetchPageText(promo.source_url)

  // If URL is unreachable, reject
  if (!pageText) {
    return {
      valid: false,
      reason: 'Link inacessível ou retornou erro',
      coupon_code: null,
      price: null,
      discount_pct: null,
      confidence: 'low',
    }
  }

  const client = getClient()

  const prompt = `Você é um validador de promoções. Analise se a promoção abaixo é real e válida.

PRODUTO BUSCADO: ${productQuery}

PROMOÇÃO DETECTADA:
- Título: ${promo.title}
- Snippet: ${promo.snippet ?? 'N/A'}
- Cupom detectado: ${promo.coupon_code ?? 'nenhum'}
- Preço detectado: ${promo.price ? `R$ ${promo.price}` : 'N/A'}
- Desconto detectado: ${promo.discount_pct ? `${promo.discount_pct}%` : 'N/A'}

CONTEÚDO DA PÁGINA:
${pageText}

Responda APENAS com JSON neste formato exato:
{
  "valid": true/false,
  "reason": "explicação curta",
  "coupon_code": "CODIGO" or null,
  "price": 123.45 or null,
  "discount_pct": 30 or null,
  "confidence": "high"/"medium"/"low"
}

Critérios:
- valid=false se: link não tem relação com o produto, promoção expirada, cupom não encontrado na página, página de erro
- valid=true se: página confirma a promoção, produto encontrado, desconto/cupom verificado
- Extraia o cupom, preço e desconto EXATOS que aparecem na página (mais confiável que o snippet)
- confidence=high se o cupom aparece claramente na página, medium se promoção existe mas cupom não confirmado, low se duvidoso`

  try {
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = msg.content[0].type === 'text' ? msg.content[0].text : ''
    const json = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] ?? '{}')

    return {
      valid: json.valid ?? false,
      reason: json.reason ?? '',
      coupon_code: json.coupon_code ?? null,
      price: json.price ?? null,
      discount_pct: json.discount_pct ?? null,
      confidence: json.confidence ?? 'low',
    }
  } catch {
    // LLM failed — fall back to heuristic score
    return {
      valid: promo.score >= 50,
      reason: 'Validação LLM falhou, usando score heurístico',
      coupon_code: promo.coupon_code,
      price: promo.price,
      discount_pct: promo.discount_pct,
      confidence: 'low',
    }
  }
}

export async function validateAll(
  promos: DetectedPromotion[],
  productQuery: string,
  concurrency = 3
): Promise<Array<DetectedPromotion & { validation: ValidationResult }>> {
  const results: Array<DetectedPromotion & { validation: ValidationResult }> = []

  // Process in batches to avoid hammering APIs
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
