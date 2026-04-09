import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import type { Promotion } from '@/types'

interface Props {
  promotions: Promotion[]
}

export function PromotionList({ promotions }: Props) {
  if (promotions.length === 0) {
    return (
      <p className="text-muted-foreground text-sm py-8 text-center">
        Nenhuma promoção encontrada ainda. O sistema buscará automaticamente.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      {promotions.map((p) => (
        <Card key={p.id} className="hover:shadow-sm transition-shadow">
          <CardContent className="pt-4 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <a
                href={p.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-sm hover:underline leading-tight"
              >
                {p.title}
              </a>
              {p.notified_at ? (
                <Badge variant="secondary" className="shrink-0 text-xs">Notificado</Badge>
              ) : (
                <Badge variant="outline" className="shrink-0 text-xs">Pendente</Badge>
              )}
            </div>

            {p.snippet && (
              <p className="text-xs text-muted-foreground line-clamp-2">{p.snippet}</p>
            )}

            <div className="flex flex-wrap gap-2 text-xs">
              {p.coupon_code && (
                <span className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 rounded px-2 py-0.5 font-mono font-bold">
                  {p.coupon_code}
                </span>
              )}
              {p.price && (
                <span className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded px-2 py-0.5">
                  R$ {p.price.toFixed(2)}
                </span>
              )}
              {p.discount_pct && (
                <span className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200 rounded px-2 py-0.5">
                  -{p.discount_pct}%
                </span>
              )}
              <span className="text-muted-foreground ml-auto">
                {format(new Date(p.found_at), "dd/MM/yy 'às' HH:mm", { locale: ptBR })}
              </span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
