import type { Promotion, Alert } from '@/types'

export async function sendPromotionEmail(
  to: string,
  alert: Alert,
  promotions: Promotion[]
): Promise<string> {
  const { Resend } = await import('resend')
  const resend = new Resend(process.env.RESEND_API_KEY)

  const promoList = promotions
    .map(
      (p) =>
        `<li>
          <strong><a href="${p.source_url}">${p.title}</a></strong><br/>
          ${p.snippet ?? ''}
          ${p.coupon_code ? `<br/><b>Cupom:</b> <code>${p.coupon_code}</code>` : ''}
          ${p.price ? `<br/><b>Preço:</b> R$ ${p.price.toFixed(2)}` : ''}
          ${p.discount_pct ? `<br/><b>Desconto:</b> ${p.discount_pct}%` : ''}
        </li>`
    )
    .join('')

  const { data, error } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL ?? 'ideal-promo <noreply@ideal-promo.app>',
    to,
    subject: `[ideal-promo] ${promotions.length} promoção(ões) encontrada(s) para "${alert.label}"`,
    html: `
      <h2>Promoções encontradas para <em>${alert.label}</em></h2>
      <ul>${promoList}</ul>
      <p style="color:#888;font-size:12px">
        Você receberá alertas até ${alert.end_date}.
        <a href="${process.env.NEXT_PUBLIC_APP_URL}/alerts/${alert.id}">Ver detalhes</a>
      </p>
    `,
  })

  if (error) throw new Error(`Resend error: ${error.message}`)
  return data!.id
}
