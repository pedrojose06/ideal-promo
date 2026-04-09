import type { Promotion, Alert } from '@/types'

// Z-API integration (https://z-api.io)
// Replace with Twilio if you prefer the official WhatsApp Business API.

export async function sendPromotionWhatsapp(
  phoneNumber: string, // E.164: +5511999999999
  alert: Alert,
  promotions: Promotion[]
): Promise<string> {
  const lines = promotions.map((p) => {
    const parts = [`*${p.title}*`, p.source_url]
    if (p.coupon_code) parts.push(`Cupom: \`${p.coupon_code}\``)
    if (p.price) parts.push(`Preço: R$ ${p.price.toFixed(2)}`)
    if (p.discount_pct) parts.push(`Desconto: ${p.discount_pct}%`)
    return parts.join('\n')
  })

  const message = [
    `🛍️ *ideal-promo* — ${promotions.length} promoção(ões) para *${alert.label}*`,
    '',
    lines.join('\n\n'),
    '',
    `Ver todos: ${process.env.NEXT_PUBLIC_APP_URL}/alerts/${alert.id}`,
  ].join('\n')

  // Z-API endpoint
  const instanceId = process.env.ZAPI_INSTANCE_ID
  const token = process.env.ZAPI_TOKEN
  const clientToken = process.env.ZAPI_CLIENT_TOKEN

  const res = await fetch(
    `https://api.z-api.io/instances/${instanceId}/token/${token}/send-text`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Client-Token': clientToken!,
      },
      body: JSON.stringify({
        phone: phoneNumber.replace('+', ''),
        message,
      }),
    }
  )

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Z-API error: ${res.status} ${body}`)
  }

  const data = await res.json()
  return data.zaapId ?? data.messageId ?? 'sent'
}
