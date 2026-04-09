'use client'

import Link from 'next/link'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { Alert } from '@/types'

interface Props {
  alert: Alert
}

export function AlertCard({ alert }: Props) {
  const today = new Date().toISOString().slice(0, 10)
  const isExpired = alert.end_date < today
  const isActive = alert.is_active && !isExpired

  return (
    <Link href={`/alerts/${alert.id}`}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-base leading-tight">{alert.label}</CardTitle>
            <Badge variant={isActive ? 'default' : 'secondary'}>
              {isExpired ? 'Expirado' : isActive ? 'Ativo' : 'Pausado'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          {alert.search_query && (
            <p className="truncate">
              <span className="font-medium text-foreground">Busca:</span> {alert.search_query}
            </p>
          )}
          {alert.product_url && (
            <p className="truncate">
              <span className="font-medium text-foreground">URL:</span> {alert.product_url}
            </p>
          )}
          <p>
            <span className="font-medium text-foreground">Período:</span>{' '}
            {format(new Date(alert.start_date + 'T00:00:00'), 'dd/MM/yy', { locale: ptBR })} →{' '}
            {format(new Date(alert.end_date + 'T00:00:00'), 'dd/MM/yy', { locale: ptBR })}
          </p>
          <p>
            <span className="font-medium text-foreground">Frequência:</span>{' '}
            a cada {alert.frequency_hours}h
          </p>
          {alert.last_run_at && (
            <p>
              <span className="font-medium text-foreground">Última busca:</span>{' '}
              {format(new Date(alert.last_run_at), "dd/MM/yy 'às' HH:mm", { locale: ptBR })}
            </p>
          )}
        </CardContent>
      </Card>
    </Link>
  )
}
