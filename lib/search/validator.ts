import type { DetectedPromotion } from './promotion-detector'

const FETCH_TIMEOUT_MS = 4000
const MAX_PAGE_CHARS = 3000
const GEMINI_TIMEOUT_MS = 5000

export interface ValidationResult {
  valid: boolean
  reason: string
  coupon_code: string | null
  price: number | null
  discount_pct: number | null
  confidence: 'high' | 'medium' | 'low'
}

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

    return { text, status: res.status }
  } catch {
    return null
  }
}

async function validateWithGemini(
  pageText: string,
  promo: DetectedPromotion,
  productQuery: string
): Promise<ValidationResult> {
  const { GoogleGenerativeAI } = await import('@google/generative-ai')
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

  const prompt = `Você é um validador de promoções e cupons. Analise se a promoção abaixo é real e válida com base no conteúdo da página.

PRODUTO BUSCADO: ${productQuery}

PROMOÇÃO DETECTADA:
- Título: ${promo.title}
- Cupom detectado: ${promo.coupon_code ?? 'nenhum'}
- Preço detectado: ${promo.price ? `R$ ${promo.price}` : 'N/A'}
- Desconto detectado: ${promo.discount_pct ? `${promo.discount_pct}%` : 'N/A'}

CONTEÚDO DA PÁGINA:
${pageText}

Analise e responda APENAS com JSON neste formato exato (sem markdown, sem explicação):
{
  "valid": true ou false,
  "reason": "explicação curta em português",
  "coupon_code": "CODIGO" ou null,
  "price": 123.45 ou null,
  "discount_pct": 30 ou null,
  "confidence": "high" ou "medium" ou "low"
}

Regras:
- valid=false se: página não tem relação com o produto, promoção claramente expirada, cupom não aparece na página, página de erro
- valid=true se: página confirma a promoção para o produto buscado
- Extraia cupom, preço e desconto EXATOS da página (ignore o que foi detectado se a página mostrar valores diferentes)
- confidence=high se cupom aparece claramente, medium se promoção existe mas cupom não confirmado, low se duvidoso`

  const result = await Promise.race([
    model.generateContent(prompt),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Gemini timeout')), GEMINI_TIMEOUT_MS)
    ),
  ])
  const text = result.response.text().trim()

  const json = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] ?? '{}')

  return {
    valid: json.valid ?? false,
    reason: json.reason ?? '',
    coupon_code: json.coupon_code ?? null,
    price: json.price ?? null,
    discount_pct: json.discount_pct ?? null,
    confidence: json.confidence ?? 'low',
  }
}

function fallbackValidation(
  pageText: string,
  promo: DetectedPromotion,
  productQuery: string
): ValidationResult {
  const text = pageText.toLowerCase()
  const expired = ['expirado', 'expired', 'encerrado', 'not found', '404', 'esgotado', 'não disponível']
  if (expired.some((kw) => text.includes(kw))) {
    return { valid: false, reason: 'Página indica promoção expirada', coupon_code: null, price: null, discount_pct: null, confidence: 'medium' }
  }
  const words = productQuery.toLowerCase().split(/\s+/).filter((w) => w.length > 3)
  const match = words.filter((w) => text.includes(w)).length >= Math.ceil(words.length * 0.5)
  return {
    valid: match && promo.score >= 30,
    reason: match ? 'Produto encontrado na página' : 'Produto não encontrado na página',
    coupon_code: promo.coupon_code,
    price: promo.price,
    discount_pct: promo.discount_pct,
    confidence: 'low',
  }
}

export async function validatePromotion(
  promo: DetectedPromotion,
  productQuery: string
): Promise<ValidationResult> {
  const result = await fetchPageText(promo.source_url)

  if (!result) {
    return { valid: false, reason: 'Link inacessível', coupon_code: null, price: null, discount_pct: null, confidence: 'low' }
  }

  if (result.status >= 400) {
    return { valid: false, reason: `Erro HTTP ${result.status}`, coupon_code: null, price: null, discount_pct: null, confidence: 'high' }
  }

  if (process.env.GEMINI_API_KEY) {
    try {
      return await validateWithGemini(result.text, promo, productQuery)
    } catch (err) {
      console.error('[validator] Gemini error, using fallback:', err)
    }
  }

  return fallbackValidation(result.text, promo, productQuery)
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
